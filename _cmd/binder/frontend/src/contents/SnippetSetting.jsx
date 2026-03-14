import { useEffect, useState, useContext } from "react";

import { Box, IconButton, List, ListItemButton, ListItemText, TextField } from "@mui/material";
import { GetSnippets, SaveSnippets } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';

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
    setBody("");
  };

  const handleSelectSnippet = (id) => {
    const item = currentList.find((s) => s.id === id);
    if (!item) return;
    setSelectedId(id);
    setBody(item.body);
  };

  const handleSave = () => {
    if (selectedId === null) return;

    const updated = {
      ...snippets,
      [category]: currentList.map((s) =>
        s.id === selectedId ? { ...s, body } : s
      ),
    };
    SaveSnippets(updated).then(() => {
      setSnippets(updated);
      evt.showSuccessMessage("Updated");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** 種別リスト */}
      <Box sx={{
        width: 110,
        flexShrink: 0,
        borderRight: '1px solid #333',
        backgroundColor: '#1a1a1a',
        pt: 1,
      }}>
        <List disablePadding>
          {CATEGORIES.map((c) => (
            <ListItemButton
              key={c.key}
              selected={category === c.key}
              onClick={() => handleSelectCategory(c.key)}
              sx={{
                py: 0.8,
                px: 1.5,
                '&.Mui-selected': { backgroundColor: '#2d3a4a', color: '#90caf9' },
                '&.Mui-selected:hover': { backgroundColor: '#2d3a4a' },
                '&:hover': { backgroundColor: '#2a2a2a' },
              }}
            >
              <ListItemText primary={c.label} primaryTypographyProps={{ fontSize: '13px' }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/** スニペット名リスト */}
      <Box sx={{
        width: 150,
        flexShrink: 0,
        borderRight: '1px solid #333',
        backgroundColor: '#202020',
        overflowY: 'auto',
        pt: 1,
      }}>
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

      {/** テキスト編集エリア */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', p: 1.5, gap: 1 }}>
        {selectedId !== null ? (<>
          <TextField
            multiline
            fullWidth
            value={body}
            onChange={(e) => setBody(e.target.value)}
            variant="outlined"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '13px', color: '#f1f1f1' } }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': { height: '100%', alignItems: 'flex-start' },
              '& .MuiInputBase-root': { height: '100%' },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={handleSave} aria-label="save">
              <SaveIcon fontSize="medium" color="primary" />
            </IconButton>
          </Box>
        </>) : (
          <Box sx={{ color: '#555', fontSize: '13px', pt: 1 }}>
            スニペットを選択してください
          </Box>
        )}
      </Box>

    </Box>
  );
}

export default SnippetSetting;
