import { useEffect, useRef, useState, forwardRef, useContext, useImperativeHandle } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemIcon, ListItemText,
  Checkbox,
} from '@mui/material';

import { GetModifiedTree, CommitFiles } from '../../bindings/binder/api/app';

import Event, { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * 変更一覧
 * @param {*} props
 * @returns
 */
function ModifiedMenu({ date: dateProp, currentId: currentIdProp, onNavigate, ...props }) {

  const evt = useContext(EventContext)
  const {t} = useTranslation();
  const params = useParams();
  const routerNav = useNavigate();

  const date = dateProp ?? params.date;
  const currentId = currentIdProp ?? params.currentId;
  const nav = onNavigate ?? routerNav;

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);

  const noteRef = useRef(null);
  const diagramRef = useRef(null);
  const assetRef = useRef(null);
  const templateRef = useRef(null);

  useEffect(() => {

    //コミットの登録
    evt.register("ModifiedMenu", Event.ModifiedCommit, function (comment) {

      var files = [];
      files.push(...noteRef.current.checked());
      files.push(...diagramRef.current.checked());
      files.push(...assetRef.current.checked());
      files.push(...templateRef.current.checked());

      CommitFiles(files, comment).then(() => {
        evt.showSuccessMessage(t("commitModal.commitSuccess"));
        setTimeout(function () {
          nav("/status/modified/" + (new Date()).toISOString());
        }, 1000);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    });

    evt.changeTitle(t("commitModal.modifiedFiles"));

    //更新一覧を取得
    GetModifiedTree().then((tree) => {

      var data = tree.data;
      var comment = "Updated:";

      var writeComment = function (prefix, children) {
        if (children.length === 0) return;
        comment += "\n  " + prefix + ":";
        children.forEach((l) => {
          comment += "\n    " + l.name;
        });
      }

      data.map((leaf) => {

        var leafs = leaf.children;
        if (leafs === undefined || leafs === null) {
          leafs = [];
        }

        if (leaf.id === "DIR_Note") {
          if (leafs.length != notes.length) {
            setNotes(leafs);
          }
          writeComment("Note", leafs)
        } else if (leaf.id === "DIR_Diagram") {
          if (leafs.length != diagrams.length) {
            setDiagrams(leafs)
          }
          writeComment("Diagram", leafs)
        } else if (leaf.id === "DIR_Asset") {
          if (leafs.length != templates.length) {
            setAssets(leafs)
          }
          writeComment("Asset", leafs)
        } else if (leaf.id === "DIR_Template") {
          if (leafs.length != assets.length) {
            setTemplates(leafs)
          }
          writeComment("Template", leafs)
        }
      })

      //コメント欄を更新
      evt.raise(Event.ModifiedComment, comment);

    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  }, [date])

  const handleOpen = (e, leaf) => {
    evt.changeTitle(leaf.name);
    nav("/status/modified/" + leaf.type + "/" + leaf.id);
  }

  return (
    <List dense disablePadding className='treeText'
      sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <ModifiedList name="Note"     data={notes}     onClick={handleOpen} selectedId={currentId} ref={noteRef} />
      <ModifiedList name="Diagram"  data={diagrams}  onClick={handleOpen} selectedId={currentId} ref={diagramRef} />
      <ModifiedList name="Asset"    data={assets}    onClick={handleOpen} selectedId={currentId} ref={assetRef} />
      <ModifiedList name="Template" data={templates} onClick={handleOpen} selectedId={currentId} ref={templateRef} />
    </List>
  );
}

/**
 * セクション単位の一覧
 * @param {*} props
 * @returns
 */
const ModifiedList = forwardRef((props, ref) => {

  const [data, setData] = useState([]);
  const [all, setAll] = useState(false);

  const disabled = data.length === 0;

  useEffect(() => {
    const wk = props.data.map((leaf) => ({ ...leaf, checked: true }));
    setAll(props.data.length > 0);
    setData(wk);
  }, [props.data]);

  const checked = () => data.filter((v) => v.checked);

  useImperativeHandle(ref, () => ({ checked }), [data]);

  const handleChecked = (e, l) => {
    e.stopPropagation();
    e.preventDefault();
    setData(data.map((leaf) => leaf.id === l.id ? { ...leaf, checked: !leaf.checked } : leaf));
  };

  const handleCheckedAll = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const ans = !all;
    setAll(ans);
    setData(data.map((leaf) => ({ ...leaf, checked: ans })));
  };

  return (<>
    <ListSubheader disableSticky
      sx={{
        display: 'flex', alignItems: 'center',
        lineHeight: '28px', pt: 0, pb: 0, pl: 0.5, pr: 0.5,
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', opacity: 0.6,
        backgroundColor: 'var(--bg-overlay)', color: 'inherit',
      }}>
      <Checkbox
        size="small"
        checked={all}
        disabled={disabled}
        onClick={handleCheckedAll}
        sx={{ p: 0.5 }}
      />
      {props.name}
    </ListSubheader>

    {data.map((leaf) => (
      <ListItemButton key={leaf.id}
        selected={leaf.id === props.selectedId}
        sx={{
          pl: 2, py: 0.25, borderRadius: '2px',
          '&.Mui-selected': { backgroundColor: 'var(--selected-bg)' },
          '&.Mui-selected:hover': { backgroundColor: 'var(--selected-bg)' },
        }}
        onClick={(e) => props.onClick(e, leaf)}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Checkbox
            size="small"
            checked={leaf.checked}
            onClick={(e) => handleChecked(e, leaf)}
            sx={{ p: 0.5 }}
          />
        </ListItemIcon>
        <ListItemText
          primary={leaf.name}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }}
        />
      </ListItemButton>
    ))}
  </>);

});

export default ModifiedMenu;
