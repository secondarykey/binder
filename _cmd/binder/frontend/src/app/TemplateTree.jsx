import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Menu, MenuItem, List, ListSubheader, ListItemButton, ListItemIcon, ListItemText, IconButton, Dialog, DialogTitle, DialogContentText, DialogActions, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

import { GetTemplateTree, UpdateTemplateSeqs, RemoveTemplate } from '../../bindings/binder/api/app';
import { OpenHistoryWindow } from '../../bindings/main/window';

import "../language";
import { useTranslation } from 'react-i18next';

import Event, { EventContext } from '../Event';
import { ActionButton } from '../dialogs/components/ActionButton';
import { ActionButton } from '../dialogs/components/ActionButton';
import TemplateMetaDialog from '../dialogs/TemplateMetaDialog';

{/** ドラッグ可能なテンプレートアイテム */}
function SortableTemplateItem({ item, selectedId, onOpen, onContextMenu, onDelete }) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      style={style}
      selected={selectedId === item.id}
      onClick={(e) => onOpen(e, item.id)}
      onContextMenu={(e) => onContextMenu(e, item.id, item.name)}
      sx={{
        pl: '5px',
        py: 0.25,
        pr: '5px',
        borderRadius: '2px',
        '&.Mui-selected': { backgroundColor: 'var(--selected-bg)' },
        '&.Mui-selected:hover': { backgroundColor: 'var(--selected-bg)' },
      }}>

      {/** ドラッグハンドル: クリックイベントが親に伝播しないようにする */}
      <ListItemIcon
        sx={{ minWidth: 24, cursor: 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}>
        <DragIndicatorIcon sx={{ fontSize: '16px', opacity: 0.35 }} />
      </ListItemIcon>

      <ListItemText primary={item.name} primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }} />

      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.name); }}
        sx={{ '& svg': { fill: 'var(--accent-red)' } }}
      >
        <DeleteIcon sx={{ fontSize: '15px' }} />
      </IconButton>
    </ListItemButton>
  );
}

{/** HTMLテンプレートのリスト（layout / content） — DnD並び替え対応 */}
function TemplateTree(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

  const [layoutItems, setLayoutItems] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [diagramItems, setDiagramItems] = useState([]);
  const [id, setId] = useState(undefined);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState(undefined);

  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });
  const [metaDialog, setMetaDialog] = useState({ open: false, id: null, type: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });

  // ドラッグ開始までの距離（px）: クリックとドラッグを区別する
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const getSection = (tree, dirId) => {
    if (!tree || tree.length === 0) return [];
    const root = tree[0]; // DIR_HTML
    if (!root || !root.children) return [];
    const dir = root.children.find(c => c.id === dirId);
    return dir && dir.children ? dir.children : [];
  };

  const viewTree = () => {
    GetTemplateTree().then((resp) => {
      const tree = resp.data;
      setLayoutItems(getSection(tree, "DIR_HTML_Layout"));
      setContentItems(getSection(tree, "DIR_HTML_Content"));
      setDiagramItems(getSection(tree, "DIR_Diagram_Style"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  useEffect(() => {
    evt.register("TemplateTree", Event.ReloadTree, () => {
      viewTree();
    });
    viewTree();
  }, []);

  const closeMenu = () => {
    setId(undefined);
    setContextMenu({ open: false, x: 0, y: 0 });
  };

  // テンプレート本文を開く（シングルクリック）
  const handleTemplateOpen = (e, leafId) => {
    setSelectedId(leafId);
    nav("/editor/template/" + leafId);
  };

  // テンプレート右クリックでコンテキストメニューを表示
  const handleContextMenu = (e, leafId, leafName) => {
    e.preventDefault();
    setId(leafId);
    setName(leafName ?? '');
    setContextMenu({ open: true, x: e.clientX, y: e.clientY });
    e.stopPropagation();
  };

  // テンプレートメタ情報編集ダイアログを開く（右クリックメニューから）
  const handleEditTemplate = () => {
    const targetId = id;
    closeMenu();
    setMetaDialog({ open: true, id: targetId, type: null });
  };

  // テンプレート履歴ウィンドウを開く（右クリックメニューから）
  const handleHistoryTemplate = () => {
    const targetId = id;
    const targetName = name;
    closeMenu();
    OpenHistoryWindow('template', targetId, targetName).catch(err => evt.showErrorMessage(err));
  };

  // テンプレート新規作成ダイアログを開く（セクションヘッダーの + ボタン）
  const handleRegisterTemplate = (dirId) => {
    const type = dirId === "DIR_HTML_Layout" ? "layout" : dirId === "DIR_Diagram_Style" ? "diagram" : "content";
    setMetaDialog({ open: true, id: null, type });
  };

  // 削除アイコンクリック: 確認ダイアログを表示
  const handleDeleteClick = (itemId, itemName) => {
    setConfirmDelete({ open: true, id: itemId, name: itemName });
  };

  // 削除確認: テンプレートを削除してツリーを更新
  const handleDeleteConfirm = () => {
    const targetId = confirmDelete.id;
    setConfirmDelete({ open: false, id: null, name: '' });
    RemoveTemplate(targetId).then(() => {
      evt.showSuccessMessage(t("template.removeSuccess"));
      viewTree();
    }).catch((err) => evt.showErrorMessage(err));
  };

  // 一括公開: PublishModal をテンプレートモードで開く
  const handleBatchPublish = () => {
    const targetId = id;
    const targetName = name;
    closeMenu();
    evt.openPublishModal({ id: targetId, name: targetName });
  };

  // DnD終了: 並び替えてバックエンドに seq を保存
  const handleDragEnd = (event, setItems) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex(i => i.id === active.id);
      const newIndex = prev.findIndex(i => i.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);

      UpdateTemplateSeqs(next.map(i => i.id)).catch((err) => {
        evt.showErrorMessage(err);
        // 失敗したら元の順序に戻す
        setItems(prev);
      });

      return next;
    });
  };

  return (<div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

    <List dense disablePadding className='treeText'
      sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

      {/** Layout セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, backgroundColor: 'var(--bg-overlay)', color: 'inherit' }}>
        Layout
        <ActionButton variant="save" label={t("common.add")} icon={<AddIcon />} onClick={() => handleRegisterTemplate("DIR_HTML_Layout")} size="small" />
      </ListSubheader>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={(e) => handleDragEnd(e, setLayoutItems)}>
        <SortableContext items={layoutItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {layoutItems.map(item => (
            <SortableTemplateItem
              key={item.id}
              item={item}
              selectedId={selectedId}
              onOpen={handleTemplateOpen}
              onContextMenu={handleContextMenu}
              onDelete={handleDeleteClick}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/** Content セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, backgroundColor: 'var(--bg-overlay)', color: 'inherit' }}>
        Content
        <ActionButton variant="save" label={t("common.add")} icon={<AddIcon />} onClick={() => handleRegisterTemplate("DIR_HTML_Content")} size="small" />
      </ListSubheader>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={(e) => handleDragEnd(e, setContentItems)}>
        <SortableContext items={contentItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {contentItems.map(item => (
            <SortableTemplateItem
              key={item.id}
              item={item}
              selectedId={selectedId}
              onOpen={handleTemplateOpen}
              onContextMenu={handleContextMenu}
              onDelete={handleDeleteClick}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/** Diagram セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, backgroundColor: 'var(--bg-overlay)', color: 'inherit' }}>
        Diagram
        <ActionButton variant="save" label={t("common.add")} icon={<AddIcon />} onClick={() => handleRegisterTemplate("DIR_Diagram_Style")} size="small" />
      </ListSubheader>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={(e) => handleDragEnd(e, setDiagramItems)}>
        <SortableContext items={diagramItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {diagramItems.map(item => (
            <SortableTemplateItem
              key={item.id}
              item={item}
              selectedId={selectedId}
              onOpen={handleTemplateOpen}
              onContextMenu={handleContextMenu}
              onDelete={handleDeleteClick}
            />
          ))}
        </SortableContext>
      </DndContext>

    </List>

    {/** テンプレートメニュー（右クリック） */}
    <Menu
      open={contextMenu.open}
      onClose={closeMenu}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleEditTemplate} divider>{t("common.edit")}</MenuItem>
      <MenuItem onClick={handleBatchPublish} divider>{t("template.batchPublish")}</MenuItem>
      <MenuItem onClick={handleHistoryTemplate}>{t("common.history")}</MenuItem>
    </Menu>

    {/** メタ編集ダイアログ */}
    <TemplateMetaDialog
      open={metaDialog.open}
      id={metaDialog.id}
      type={metaDialog.type}
      onClose={() => setMetaDialog({ open: false, id: null, type: null })}
    />

    {/** 削除確認ダイアログ */}
    <Dialog
      open={confirmDelete.open}
      onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
      PaperProps={{ style: { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' } }}
    >
      <DialogTitle>{t("template.deleteTitle")}</DialogTitle>
      <DialogContentText style={{ padding: '0 24px 8px', color: 'var(--text-secondary)' }}>
        {t("template.deleteConfirm", { name: confirmDelete.name })}
      </DialogContentText>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setConfirmDelete({ open: false, id: null, name: '' })} />
        <ActionButton variant="delete" label={t("common.delete")} icon={<DeleteIcon />} onClick={handleDeleteConfirm} />
      </DialogActions>
    </Dialog>

  </div>);
}
export default TemplateTree;
