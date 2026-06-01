import { useEffect, useState } from "react";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import { Box, Button, DialogContent, FormControl, FormLabel, IconButton, TextField, MenuItem, Select } from "@mui/material";
import { Close } from "@mui/icons-material";

/**
 * 共有フォント設定ダイアログ
 *
 * Props:
 *   open       - 表示状態
 *   font       - 現在のフォント設定 { name, size, color, backgroundColor }
 *   fontNames  - システムフォント名の一覧 (string[])
 *   title      - ダイアログタイトル
 *   okLabel    - OKボタンのラベル
 *   sampleLabel - サンプルのラベル
 *   labels     - { name, size, color, backgroundColor } 各フィールドのラベル
 *   onSave     - 保存コールバック (font) => void
 *   onClose    - 閉じるコールバック () => void
 */
export default function FontDialog({ open, font, fontNames, title, okLabel, sampleLabel, labels, onSave, onClose }) {

  const [name, setName] = useState("monospace");
  const [size, setSize] = useState(14);
  const [color, setColor] = useState("#e0e0e0");
  const [bgcolor, setBGColor] = useState("#1e1e1e");

  const [text, setText] = useState(`package main
import "fmt"

func main() {
  fmt.Println("Hello, Binder!")
}`);

  useEffect(() => {
    if (!font) return;
    setName(font.name || "monospace");
    setSize(font.size || 14);
    setColor(font.color || "#e0e0e0");
    setBGColor(font.backgroundColor || "#1e1e1e");
  }, [font]);

  const previewStyle = {
    fontFamily: name,
    fontSize: size + "px",
    color: color,
    backgroundColor: bgcolor,
  };

  const handleSave = () => {
    onSave({
      name,
      size: Number(size),
      color,
      backgroundColor: bgcolor,
    });
  };

  const lb = labels || {};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", width: "100%", maxWidth: "600px" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: '12px', fontSize: '15px' }}>
        <span style={{ flex: 1 }}>{title || "Font"}</span>
        <IconButton size="small" onClick={onClose} aria-label="close" sx={{ color: 'var(--text-muted)' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>

        {/* フォント名・サイズ */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, mt: 1 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lb.name || "Font"}</FormLabel>
            {fontNames && fontNames.length > 0 ? (
              <Select
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                MenuProps={{ PaperProps: { style: { maxHeight: 10 * 36, backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' } } }}
                sx={{ fontSize: '13px', color: 'var(--text-primary)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
              >
                {fontNames.map((v) => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            ) : (
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                sx={{ '& input': { fontSize: '13px', color: 'var(--text-primary)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
              />
            )}
          </FormControl>
          <FormControl sx={{ width: "80px" }}>
            <FormLabel sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lb.size || "Size"}</FormLabel>
            <TextField
              value={size}
              onChange={(e) => setSize(e.target.value)}
              type="number"
              size="small"
              inputProps={{ min: 8, max: 48 }}
              sx={{ '& input': { fontSize: '13px', color: 'var(--text-primary)', textAlign: 'right' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
            />
          </FormControl>
        </Box>

        {/* 文字色・背景色 */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lb.color || "Color"}</FormLabel>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--border-input)', cursor: 'pointer', backgroundColor: 'transparent', borderRadius: 4 }}
              />
              <TextField
                value={color}
                onChange={(e) => setColor(e.target.value)}
                size="small"
                sx={{ flex: 1, '& input': { fontSize: '12px', color: 'var(--text-primary)', py: 0.5 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
              />
            </Box>
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lb.backgroundColor || "Background"}</FormLabel>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                value={bgcolor}
                onChange={(e) => setBGColor(e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid var(--border-input)', cursor: 'pointer', backgroundColor: 'transparent', borderRadius: 4 }}
              />
              <TextField
                value={bgcolor}
                onChange={(e) => setBGColor(e.target.value)}
                size="small"
                sx={{ flex: 1, '& input': { fontSize: '12px', color: 'var(--text-primary)', py: 0.5 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
              />
            </Box>
          </FormControl>
        </Box>

        {/* サンプル */}
        <FormControl sx={{ width: "100%" }}>
          <FormLabel sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sampleLabel || "Sample"}</FormLabel>
          <TextField
            multiline
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: bgcolor + ' !important',
                height: '180px',
                alignItems: 'flex-start',
                overflow: 'auto',
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
            }}
            slotProps={{ input: { style: previewStyle } }}
          />
        </FormControl>

      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={handleSave}
          size="small"
          sx={{
            color: 'var(--accent-blue)',
            textTransform: 'none',
            fontSize: '12px',
            fontWeight: 600,
            '&:hover': { backgroundColor: 'var(--bg-elevated)' },
          }}
        >
          {okLabel || "OK"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
