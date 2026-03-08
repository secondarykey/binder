import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Menu, MenuItem, List, ListSubheader, ListItemButton, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import AddIcon from '@mui/icons-material/Add';

import { GetTemplateTree, UpdateTemplateSeqs } from '../../../bindings/binder/api/app';

import Event, { EventContext } from '../../Event';

{/** ドラッグ可能なテンプレートアイテム */}
function SortableTemplateItem({ item, selectedId, onOpen, onContextMenu }) {

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
      onContextMenu={(e) => onContextMenu(e, item.id)}
      sx={{ pl: 1 }}>

      {/** ドラッグハンドル: クリックイベントが親に伝播しないようにする */}
      <ListItemIcon
        sx={{ minWidth: 24, cursor: 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}>
        <DragHandleIcon fontSize="small" sx={{ opacity: 0.35 }} />
      </ListItemIcon>

      <ListItemIcon sx={{ minWidth: 28 }}>
        <TextSnippetIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={item.name} primaryTypographyProps={{ noWrap: true }} />
    </ListItemButton>
  );
}

{/** HTMLテンプレートのリスト（layout / content） — DnD並び替え対応 */}
function TemplateTree(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();

  const [layoutItems, setLayoutItems] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [id, setId] = useState(undefined);
  const [selectedId, setSelectedId] = useState(undefined);

  const [templateEl, setTemplateEl] = useState(null);
  const templateMenu = Boolean(templateEl);

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
    setTemplateEl(null);
  };

  // テンプレート本文を開く（シングルクリック）
  const handleTemplateOpen = (e, leafId) => {
    setSelectedId(leafId);
    nav("/editor/template/" + leafId);
  };

  // テンプレート右クリックでコンテキストメニューを表示
  const handleContextMenu = (e, leafId) => {
    e.preventDefault();
    setId(leafId);
    setTemplateEl(e.currentTarget);
    e.stopPropagation();
  };

  // テンプレートメタ情報編集（右クリックメニューから）
  const handleEditTemplate = () => {
    setTemplateEl(null);
    nav("/template/edit/" + id);
    setId(undefined);
  };

  // テンプレート新規作成（セクションヘッダーの + ボタン）
  const handleRegisterTemplate = (dirId) => {
    nav("/template/register/" + dirId);
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

  return (<>

    <List dense disablePadding className='treeText'>

      {/** Layout セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '32px', backgroundColor: 'transparent', color: 'inherit' }}>
        Layout
        <IconButton size="small" onClick={() => handleRegisterTemplate("DIR_HTML_Layout")}>
          <AddIcon fontSize="small" />
        </IconButton>
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
            />
          ))}
        </SortableContext>
      </DndContext>

      {/** Content セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '32px', backgroundColor: 'transparent', color: 'inherit' }}>
        Content
        <IconButton size="small" onClick={() => handleRegisterTemplate("DIR_HTML_Content")}>
          <AddIcon fontSize="small" />
        </IconButton>
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
            />
          ))}
        </SortableContext>
      </DndContext>

    </List>

    {/** テンプレートメニュー（右クリック） */}
    <Menu anchorEl={templateEl}
      open={templateMenu}
      onClose={closeMenu}>
      <MenuItem onClick={handleEditTemplate}>Edit</MenuItem>
    </Menu>

  </>);
}
export default TemplateTree;
