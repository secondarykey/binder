import { useEffect, useRef, useState, forwardRef, useContext, useImperativeHandle } from 'react';

import {
  List, ListSubheader, ListItemButton, ListItemIcon, ListItemText,
  Checkbox,
} from '@mui/material';

import {
  GetUnpublishedTree,
  OpenNote, OpenDiagram,
  ParseNote, Generate,
} from '../../bindings/binder/api/app';

import Marked from '../pages/editor/engines/Marked';
import Mermaid from '../pages/editor/engines/Mermaid';

import Event, { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * 未公開一覧
 * ModifiedMenu と同じ構造で Note/Diagram/Asset を表示し、
 * PublishGenerate イベントを受け取ったら選択済みファイルを順次 Generate する。
 */
function UnpublishedMenu({ date: dateProp, onNavigate, ...props }) {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);

  const noteRef = useRef(null);
  const diagramRef = useRef(null);
  const assetRef = useRef(null);

  const loadTree = () => {
    GetUnpublishedTree().then((tree) => {

      const data = tree.data ?? [];
      var comment = "Generate:";

      const writeComment = (prefix, children) => {
        if (children.length === 0) return;
        comment += "\n  " + prefix + ":";
        children.forEach((l) => { comment += "\n    " + l.name; });
      };

      data.forEach((leaf) => {
        const leafs = leaf.children ?? [];
        if (leaf.id === "DIR_Note") {
          setNotes(leafs);
          writeComment("Note", leafs);
        } else if (leaf.id === "DIR_Diagram") {
          setDiagrams(leafs);
          writeComment("Diagram", leafs);
        } else if (leaf.id === "DIR_Asset") {
          setAssets(leafs);
          writeComment("Asset", leafs);
        }
      });

      evt.raise(Event.PublishComment, comment);

    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  useEffect(() => {

    // GenerateForm からの Generate 実行イベント
    evt.register("UnpublishedMenu", Event.PublishGenerate, async function () {

      const selected = [
        ...(noteRef.current?.checked() ?? []),
        ...(diagramRef.current?.checked() ?? []),
        ...(assetRef.current?.checked() ?? []),
      ];

      if (selected.length === 0) {
        evt.showWarningMessage(t("publishModal.noFilesSelected"));
        return;
      }

      for (const leaf of selected) {
        try {
          if (leaf.type === "note") {
            const text = await OpenNote(leaf.id);
            const parsed = await ParseNote(leaf.id, false, text);
            const html = await Marked.parse(parsed);
            await Generate("note", leaf.id, html);
          } else if (leaf.type === "diagram") {
            const text = await OpenDiagram(leaf.id);
            const obj = await Mermaid.parse(text);
            await Generate("diagram", leaf.id, obj.svg);
          } else {
            // asset
            await Generate("assets", leaf.id, "");
          }
        } catch (err) {
          evt.showErrorMessage(`${leaf.name}: ${err}`);
          return;
        }
      }

      evt.showSuccessMessage(t("publishModal.generateSuccess"));
      // 一覧を再取得
      setTimeout(() => {
        loadTree();
      }, 800);
    });

    loadTree();

  }, [dateProp]);

  return (
    <List dense disablePadding className='treeText'
      sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <UnpublishedList name="Note"    data={notes}    ref={noteRef} />
      <UnpublishedList name="Diagram" data={diagrams} ref={diagramRef} />
      <UnpublishedList name="Asset"   data={assets}   ref={assetRef} />
    </List>
  );
}

/**
 * セクション単位の一覧（チェックボックス付き）
 */
const UnpublishedList = forwardRef((props, ref) => {

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
        sx={{
          pl: 2, py: 0.25, borderRadius: '2px',
          '&:hover': { backgroundColor: 'var(--selected-bg)' },
        }}>
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

export default UnpublishedMenu;
