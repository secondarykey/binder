import { useEffect, useRef, useState, forwardRef, useContext, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router';

import {
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, List, ListSubheader, ListItemButton, ListItemIcon, ListItemText,
  Checkbox, Menu, MenuItem, Tooltip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import {
  GetUnpublishedTree, GetPublishedNotesByTemplate,
  OpenNote, OpenDiagram,
  ParseNote, ParseDiagram, GenerateAll, UnpublishAll,
} from '../../bindings/binder/api/app';

import Marked from '../components/editor/engines/Marked';
import Mermaid from '../components/editor/engines/Mermaid';

import Event, { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * 未公開一覧
 * ModifiedMenu と同じ構造で Note/Diagram/Asset を表示し、
 * PublishGenerate イベントを受け取ったら選択済みファイルを順次 Generate する。
 */
function UnpublishedMenu({ date: dateProp, template, onNavigate, onClose, ...props }) {

  const evt = useContext(EventContext);
  const { showError, showWarning } = useDialogMessage();
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
  const [layers, setLayers] = useState([]);
  const [errorDlg, setErrorDlg] = useState({ open: false, names: [] });
  const [unpublishAllConfirm, setUnpublishAllConfirm] = useState(false);

  const doUnpublishAll = () => {
    setUnpublishAllConfirm(false);
    UnpublishAll().then(() => {
      evt.reloadUnpublished();
      loadTree();
      evt.showSuccessMessage(t("tree.unpublishAll"));
    }).catch((err) => {
      showError(err);
    });
  };

  const noteRef = useRef(null);
  const diagramRef = useRef(null);
  const assetRef = useRef(null);
  const layerRef = useRef(null);

  const loadTree = () => {
    if (template) {
      // テンプレート一括公開モード: 公開済みノートのみ取得
      GetPublishedNotesByTemplate(template.id).then((leaves) => {
        const noteLeaves = (leaves ?? []).map(l => ({ ...l, type: "note" }));
        setNotes(noteLeaves);
        setDiagrams([]);
        setAssets([]);
        const comment = t("template.batchPublishComment", { name: template.name });
        evt.raise(Event.PublishComment, comment);
      }).catch((err) => {
        showError(err);
      });
      return;
    }

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
        } else if (leaf.id === "DIR_Layer") {
          setLayers(leafs);
          writeComment("Layer", leafs);
        }
      });

      evt.raise(Event.PublishComment, comment);

    }).catch((err) => {
      showError(err);
    });
  };

  useEffect(() => {

    // GenerateForm からの Generate 実行イベント
    evt.register("UnpublishedMenu", Event.PublishGenerate, async function (comment) {

      const selected = [
        ...(noteRef.current?.checked() ?? []),
        ...(diagramRef.current?.checked() ?? []),
        ...(assetRef.current?.checked() ?? []),
        ...(layerRef.current?.checked() ?? []),
      ];

      if (selected.length === 0) {
        showWarning(t("publishModal.noFilesSelected"));
        return;
      }

      const total = selected.length;
      evt.raise(Event.PublishProgress, { running: true, current: 0, total });

      // 各アイテムをレンダリングして items 配列に積む（レンダリング失敗分は errors に記録）
      const items = [];
      const errors = [];
      for (let i = 0; i < selected.length; i++) {
        const leaf = selected[i];
        evt.raise(Event.PublishProgress, { running: true, current: i, total });
        try {
          if (leaf.type === "note") {
            const text = await OpenNote(leaf.id);
            const parsed = await ParseNote(leaf.id, false, text);
            const html = await Marked.parse(parsed);
            items.push({ mode: "note", id: leaf.id, data: html });
          } else if (leaf.type === "diagram") {
            const text = await OpenDiagram(leaf.id);
            const parsedTxt = await ParseDiagram(leaf.id, false, text);
            const obj = await Mermaid.parse(parsedTxt);
            items.push({ mode: "diagram", id: leaf.id, data: obj.svg });
          } else if (leaf.type === "layer") {
            items.push({ mode: "layer", id: leaf.id, data: "" });
          } else {
            // asset
            items.push({ mode: "assets", id: leaf.id, data: "" });
          }
        } catch (err) {
          errors.push(leaf.name);
        }
      }

      // レンダリングに成功したアイテムを1回のコミットにまとめて公開
      let generateOk = true;
      if (items.length > 0) {
        try {
          await GenerateAll(items, comment);
        } catch (err) {
          generateOk = false;
          evt.showErrorMessage(err);
        }
      }

      evt.raise(Event.PublishProgress, { running: false, current: total, total });

      if (errors.length > 0) {
        setErrorDlg({ open: true, names: errors });
        setTimeout(() => { loadTree(); }, 800);
      } else if (!generateOk) {
        setTimeout(() => { loadTree(); }, 800);
      } else if (onClose) {
        evt.showSuccessMessage(t("publishModal.generateSuccess"));
        onClose();
      } else {
        evt.showSuccessMessage(t("publishModal.generateSuccess"));
        setTimeout(() => { loadTree(); }, 800);
      }
    });

    loadTree();

  }, [dateProp]);

  return (<>
    <List dense disablePadding className='treeText'
      sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <UnpublishedList name="Note"    data={notes}    onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={noteRef} />
      <UnpublishedList name="Diagram" data={diagrams} onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={diagramRef} />
      <UnpublishedList name="Asset"   data={assets}   onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={assetRef} />
      <UnpublishedList name="Layer"   data={layers}   onDoubleClick={(e, leaf) => openItem(leaf)} onContextMenu={handleContextMenu} ref={layerRef} />
      {!template && <>
        <Divider sx={{ mt: 1 }} />
        <ListItemButton
          onClick={() => setUnpublishAllConfirm(true)}
          sx={{ py: 0.5, color: 'var(--accent-red)', '&:hover': { backgroundColor: 'var(--selected-bg)' } }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <UnpublishedIcon sx={{ fontSize: '14px', color: 'var(--accent-red)' }} />
          </ListItemIcon>
          <ListItemText primary={t("tree.unpublishAll")} primaryTypographyProps={{ fontSize: '0.8rem' }} />
        </ListItemButton>
      </>}
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
        <ActionButton variant="cancel" label={t("common.close")} icon={<CloseIcon />} onClick={() => setErrorDlg({ open: false, names: [] })} />
      </DialogActions>
    </Dialog>

    {/** 全データ未公開確認ダイアログ */}
    <Dialog open={unpublishAllConfirm} onClose={() => setUnpublishAllConfirm(false)}>
      <DialogTitle>{t("tree.unpublishAllConfirmTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("tree.unpublishAllConfirmMessage")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishAllConfirm(false)} />
        <ActionButton variant="delete" label={t("tree.unpublishAll")} icon={<UnpublishedIcon />} onClick={doUnpublishAll} />
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
