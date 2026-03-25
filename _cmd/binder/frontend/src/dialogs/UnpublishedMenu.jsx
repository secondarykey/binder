import { useEffect, useRef, useState, forwardRef, useContext, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router';

import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  List, ListSubheader, ListItemButton, ListItemIcon, ListItemText,
  Checkbox, Menu, MenuItem,
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
function UnpublishedMenu({ date: dateProp, onNavigate, onClose, ...props }) {

  const evt = useContext(EventContext);
  const {t} = useTranslation();
  const nav = useNavigate();

  // コンテキストメニュー
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, leaf: null });

  const handleContextMenu = (e, leaf) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, leaf });
  };

  const openItem = (leaf) => {
    if (!leaf) return;
    const path = leaf.type === 'asset' ? `/editor/assets/${leaf.id}` : `/editor/${leaf.type}/${leaf.id}`;
    if (onClose) onClose();
    nav(path);
    evt.selectTreeNode(leaf.id);
  };

  const handleOpenItem = () => {
    const leaf = contextMenu.leaf;
    setContextMenu({ open: false, x: 0, y: 0, leaf: null });
    openItem(leaf);
  };

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);
  const [errorDlg, setErrorDlg] = useState({ open: false, names: [] });

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

      const errors = [];
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
          errors.push(leaf.name);
        }
      }

      if (errors.length > 0) {
        setErrorDlg({ open: true, names: errors });
      } else {
        evt.showSuccessMessage(t("publishModal.generateSuccess"));
      }
      // 一覧を再取得
      setTimeout(() => {
        loadTree();
      }, 800);
    });

    loadTree();

  }, [dateProp]);

  return (<>
    <List dense disablePadding className='treeText'
      sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <UnpublishedList name="Note"    data={notes}    onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={noteRef} />
      <UnpublishedList name="Diagram" data={diagrams} onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={diagramRef} />
      <UnpublishedList name="Asset"   data={assets}   onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={assetRef} />
    </List>

    <Menu open={contextMenu.open}
      onClose={() => setContextMenu({ open: false, x: 0, y: 0, leaf: null })}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}>
      <MenuItem onClick={handleOpenItem}>{t("common.open")}</MenuItem>
    </Menu>

    <Dialog open={errorDlg.open} onClose={() => setErrorDlg({ open: false, names: [] })}>
      <DialogTitle>{t("publishModal.generateError")}</DialogTitle>
      <DialogContent>
        <DialogContentText className="messageTxt" sx={{ whiteSpace: 'pre-line' }}>
          {errorDlg.names.join("\n")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setErrorDlg({ open: false, names: [] })}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  </>);
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
        }}
        onDoubleClick={(e) => props.onDoubleClick?.(e, leaf)}
        onContextMenu={(e) => props.onContextMenu?.(e, leaf)}>
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
