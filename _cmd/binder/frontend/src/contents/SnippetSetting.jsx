import { useEffect, useRef, useState, useContext } from "react";

import { Box, IconButton, InputAdornment, List, ListItemButton, ListItemText, MenuItem, Select, TextField } from "@mui/material";
import { GetSnippets, SaveSnippets } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import { EventContext } from "../Event";

const CATEGORIES = [
  { key: "markdowns", label: "Markdowns" },
  { key: "diagrams", label: "Diagrams" },
  { key: "templates", label: "Templates" },
];

/**
 * スニペット設定
 */
function SnippetSetting() {

  const evt = useContext(EventContext);
  const newNameRef = useRef(null);

  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });
  const [category, setCategory] = useState("markdowns");
  const [selectedId, setSelectedId] = useState(null);
  const [editName, setEditName] = useState("");
  const [body, setBody] = useState("");

  // 追加用
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    GetSnippets().then((s) => {
      setSnippets(s);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, []);

  // 追加入力欄が表示されたらフォーカス
  useEffect(() => {
    if (isAdding && newNameRef.current) {
      newNameRef.current.focus();
    }
  }, [isAdding]);

  const currentList = snippets[category] ?? [];

  const handleSelectCategory = (key) => {
    setCategory(key);
    setSelectedId(null);
    setEditName("");
    setBody("");
    setIsAdding(false);
    setNewName("");
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
      evt.showSuccessMessage("Updated");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** 追加確定 */
  const handleAddConfirm = () => {
    const name = newName.trim();
    if (!name) return;
    const newSnippet = { id: crypto.randomUUID(), name, body: "" };
    const updated = {
      ...snippets,
      [category]: [...currentList, newSnippet],
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      setIsAdding(false);
      setNewName("");
      setSelectedId(newSnippet.id);
      setBody("");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** 追加キャンセル */
  const handleAddCancel = () => {
    setIsAdding(false);
    setNewName("");
  };

  /** 削除 */
  const handleDelete = () => {
    if (selectedId === null) return;
    const updated = {
      ...snippets,
      [category]: currentList.filter((s) => s.id !== selectedId),
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      setSelectedId(null);
      setEditName("");
      setBody("");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** スニペット名リスト（上部にカテゴリセレクト） */}
      <Box sx={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid #333',
        backgroundColor: '#202020',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/** カテゴリセレクト + 追加ボタン */}
        <Box sx={{ px: 1, py: 0.8, borderBottom: '1px solid #333', flexShrink: 0, display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Select
            value={category}
            onChange={(e) => handleSelectCategory(e.target.value)}
            size="small"
            fullWidth
            sx={{
              fontSize: '13px',
              color: '#f1f1f1',
              backgroundColor: '#1a1a1a',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
              '& .MuiSvgIcon-root': { color: '#aaa' },
            }}
            MenuProps={{ PaperProps: { sx: { backgroundColor: '#1a1a1a', color: '#f1f1f1' } } }}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c.key} value={c.key} sx={{ fontSize: '13px' }}>
                {c.label}
              </MenuItem>
            ))}
          </Select>
          <IconButton size="small" onClick={() => setIsAdding(true)} disabled={isAdding} sx={{ color: '#aaa', '&:hover': { color: '#90caf9' }, flexShrink: 0 }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {/** 新規名称入力欄 */}
        {isAdding && (
          <Box sx={{ px: 1, py: 0.8, borderBottom: '1px solid #333', flexShrink: 0 }}>
            <TextField
              inputRef={newNameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddConfirm();
                if (e.key === 'Escape') handleAddCancel();
              }}
              size="small"
              fullWidth
              placeholder="名称を入力"
              inputProps={{ style: { fontSize: '13px', color: '#f1f1f1' } }}
              sx={{
                '& .MuiOutlinedInput-root': { backgroundColor: '#1a1a1a' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ gap: 0 }}>
                    <IconButton size="small" onClick={handleAddConfirm} sx={{ color: '#90caf9', p: 0.3 }}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={handleAddCancel} sx={{ color: '#888', p: 0.3 }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}

        {/** スニペット名リスト */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <List disablePadding>
            {currentList.map((s) => (
              <ListItemButton
                key={s.id}
                selected={selectedId === s.id}
                onClick={() => handleSelectSnippet(s.id)}
                sx={{
                  py: 0.6,
                  px: 1.5,
                  '&.Mui-selected': { backgroundColor: '#2d3a4a', color: '#90caf9' },
                  '&.Mui-selected:hover': { backgroundColor: '#2d3a4a' },
                  '&:hover': { backgroundColor: '#2a2a2a' },
                }}
              >
                <ListItemText
                  primary={s.name}
                  primaryTypographyProps={{ fontSize: '13px', noWrap: true }}
                />
              </ListItemButton>
            ))}
            {currentList.length === 0 && (
              <Box sx={{ px: 1.5, py: 1, color: '#555', fontSize: '12px' }}>
                (なし)
              </Box>
            )}
          </List>
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
          placeholder="名称"
          inputProps={{ style: { fontSize: '13px', color: '#f1f1f1' } }}
        />
        <TextField
          multiline
          rows={11}
          fullWidth
          value={body}
          onChange={(e) => setBody(e.target.value)}
          variant="outlined"
          disabled={selectedId === null}
          placeholder={selectedId === null ? "スニペットを選択してください" : ""}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '13px', color: '#f1f1f1', resize: 'none' } }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <IconButton onClick={handleDelete} aria-label="delete" disabled={selectedId === null}>
            <DeleteIcon fontSize="medium" color={selectedId !== null ? "error" : "disabled"} />
          </IconButton>
          <IconButton onClick={handleSave} aria-label="save" disabled={selectedId === null}>
            <SaveIcon fontSize="medium" color={selectedId !== null ? "primary" : "disabled"} />
          </IconButton>
        </Box>
      </Box>

    </Box>
  );
}

export default SnippetSetting;
