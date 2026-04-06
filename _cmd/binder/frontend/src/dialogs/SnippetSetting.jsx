import { useEffect, useState, useContext } from "react";

import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemText, MenuItem, Select, TextField } from "@mui/material";
import { GetSnippets, SaveSnippets } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { EventContext } from "../Event";
import "../language";
import { useTranslation } from 'react-i18next';

const CATEGORIES = [
  { key: "markdowns", labelKey: "snippetSetting.markdowns" },
  { key: "diagrams", labelKey: "snippetSetting.diagrams" },
  { key: "templates", labelKey: "snippetSetting.templates" },
];

/**
 * ドラッグ可能なスニペット行
 */
function SortableSnippetItem({ snippet, selected, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: snippet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onDelete(snippet.id); }}
          sx={{ '& svg': { fill: 'var(--accent-red)' }, mr: -1 }}
        >
          <DeleteIcon sx={{ fontSize: '15px' }} />
        </IconButton>
      }
    >
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(snippet.id)}
        sx={{
          py: 0.6,
          pl: 0.5,
          pr: 4,
          '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
          '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
          '&:hover': { backgroundColor: 'var(--bg-elevated)' },
        }}
      >
        {/** ドラッグハンドル */}
        <Box
          {...attributes}
          {...listeners}
          sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-faint)', cursor: 'grab', mr: 0.5, flexShrink: 0, '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicatorIcon sx={{ fontSize: '16px' }} />
        </Box>
        <ListItemText
          primary={snippet.name}
          primaryTypographyProps={{ fontSize: '13px', noWrap: true }}
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * スニペット設定
 */
function SnippetSetting() {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });
  const [category, setCategory] = useState("markdowns");
  const [selectedId, setSelectedId] = useState(null);
  const [editName, setEditName] = useState("");
  const [body, setBody] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    GetSnippets().then((s) => {
      setSnippets(s);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, []);

  const currentList = snippets[category] ?? [];

  const handleSelectCategory = (key) => {
    setCategory(key);
    setSelectedId(null);
    setEditName("");
    setBody("");
  };

  const handleSelectSnippet = (id) => {
    const item = currentList.find((s) => s.id === id);
    if (!item) return;
    setSelectedId(id);
    setEditName(item.name);
    setBody(item.body);
  };

  const handleSave = () => {
    if (selectedId === null) return;
    const updated = {
      ...snippets,
      [category]: currentList.map((s) =>
        s.id === selectedId ? { ...s, name: editName, body } : s
      ),
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      evt.showSuccessMessage(t("common.updated"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** + ボタン: "NewSnippet" で即時追加して選択 */
  const handleAdd = () => {
    const newSnippet = { id: crypto.randomUUID(), name: t("snippetSetting.newSnippet"), body: "" };
    const updated = {
      ...snippets,
      [category]: [...currentList, newSnippet],
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      setSelectedId(newSnippet.id);
      setEditName(newSnippet.name);
      setBody("");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** 削除ボタン押下: 確認ダイアログを開く */
  const handleDeleteRequest = (id) => {
    const item = currentList.find((s) => s.id === id);
    setDeleteConfirm({ open: true, id, name: item?.name ?? "" });
  };

  /** 削除確認後の実行 */
  const handleDeleteConfirm = () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ open: false, id: null, name: "" });
    const updated = {
      ...snippets,
      [category]: currentList.filter((s) => s.id !== id),
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      if (selectedId === id) {
        setSelectedId(null);
        setEditName("");
        setBody("");
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** 削除キャンセル */
  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, id: null, name: "" });
  };

  /** ドラッグ終了: 並び替えて保存 */
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = currentList.findIndex((s) => s.id === active.id);
    const newIndex = currentList.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(currentList, oldIndex, newIndex);
    const updated = { ...snippets, [category]: reordered };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  return (
    <>
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** スニペット名リスト */}
      <Box sx={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-overlay)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/** カテゴリセレクト + 追加ボタン */}
        <Box sx={{ px: 1, py: 0.8, borderBottom: '1px solid var(--border-primary)', flexShrink: 0, display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Select
            value={category}
            onChange={(e) => handleSelectCategory(e.target.value)}
            size="small"
            fullWidth
            sx={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-dropdown)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
              '& .MuiSvgIcon-root': { color: 'var(--text-muted)' },
            }}
            MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c.key} value={c.key} sx={{ fontSize: '13px' }}>
                {t(c.labelKey)}
              </MenuItem>
            ))}
          </Select>
          <IconButton size="small" onClick={handleAdd} sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--selected-text)' }, flexShrink: 0 }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {/** ドラッグ＆ドロップ対応スニペット名リスト */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={currentList.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <List disablePadding>
                {currentList.map((s) => (
                  <SortableSnippetItem
                    key={s.id}
                    snippet={s}
                    selected={selectedId === s.id}
                    onSelect={handleSelectSnippet}
                    onDelete={handleDeleteRequest}
                  />
                ))}
                {currentList.length === 0 && (
                  <Box sx={{ px: 1.5, py: 1, color: 'var(--text-faint)', fontSize: '12px' }}>
                    {t("snippetSetting.empty")}
                  </Box>
                )}
              </List>
            </SortableContext>
          </DndContext>
        </Box>
      </Box>

      {/** テキスト編集エリア */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', p: 1.5, gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          variant="outlined"
          disabled={selectedId === null}
          placeholder={t("snippetSetting.namePlaceholder")}
          inputProps={{ style: { fontSize: '13px', color: 'var(--text-primary)' } }}
        />
        <TextField
          multiline
          rows={11}
          fullWidth
          value={body}
          onChange={(e) => setBody(e.target.value)}
          variant="outlined"
          disabled={selectedId === null}
          placeholder={selectedId === null ? t("snippetSetting.selectSnippet") : ""}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', resize: 'none' } }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton onClick={handleSave} aria-label="save" disabled={selectedId === null}>
            <SaveIcon fontSize="medium" color={selectedId !== null ? "primary" : "disabled"} />
          </IconButton>
        </Box>
      </Box>

    </Box>

    {/** 削除確認ダイアログ */}
    <Dialog
      open={deleteConfirm.open}
      onClose={handleDeleteCancel}
      PaperProps={{ sx: { backgroundColor: 'var(--bg-dialog)', color: 'var(--text-primary)', minWidth: 320 } }}
    >
      <DialogTitle sx={{ fontSize: '14px', pb: 1 }}>{t("snippetSetting.deleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
          {t("snippetSetting.deleteConfirm", { name: deleteConfirm.name })}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={handleDeleteCancel} size="small" sx={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleDeleteConfirm} size="small" color="error" variant="contained" sx={{ fontSize: '12px' }}>
          {t("common.delete")}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

export default SnippetSetting;
