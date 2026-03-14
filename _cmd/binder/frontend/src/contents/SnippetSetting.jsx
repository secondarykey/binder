import { useEffect, useState, useContext } from "react";

import { Box, IconButton, List, ListItem, ListItemButton, ListItemText, MenuItem, Select, TextField } from "@mui/material";
import { GetSnippets, SaveSnippets } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

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

  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });
  const [category, setCategory] = useState("markdowns");
  const [selectedId, setSelectedId] = useState(null);
  const [editName, setEditName] = useState("");
  const [body, setBody] = useState("");

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
      evt.showSuccessMessage("Updated");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** + ボタン: "NewSnippet" という名前で即時追加して選択 */
  const handleAdd = () => {
    const newSnippet = { id: crypto.randomUUID(), name: "NewSnippet", body: "" };
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

  /** 削除 */
  const handleDelete = (id) => {
    const updated = {
      ...snippets,
      [category]: currentList.filter((s) => s.id !== id),
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

      {/** スニペット名リスト */}
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
          <IconButton size="small" onClick={handleAdd} sx={{ color: '#aaa', '&:hover': { color: '#90caf9' }, flexShrink: 0 }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {/** スニペット名リスト */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <List disablePadding>
            {currentList.map((s) => (
              <ListItem
                key={s.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    sx={{ color: '#888', '&:hover': { color: '#f44336' }, mr: -1 }}
                  >
                    <DeleteIcon sx={{ fontSize: '15px' }} />
                  </IconButton>
                }
              >
                <ListItemButton
                  selected={selectedId === s.id}
                  onClick={() => handleSelectSnippet(s.id)}
                  sx={{
                    py: 0.6,
                    pl: 1.5,
                    pr: 4,
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
              </ListItem>
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
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton onClick={handleSave} aria-label="save" disabled={selectedId === null}>
            <SaveIcon fontSize="medium" color={selectedId !== null ? "primary" : "disabled"} />
          </IconButton>
        </Box>
      </Box>

    </Box>
  );
}

export default SnippetSetting;
