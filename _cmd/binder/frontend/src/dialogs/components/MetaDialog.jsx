import { useContext } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Typography,
} from "@mui/material";
import { Close, ContentCopy, Delete, Save } from "@mui/icons-material";

import { copyClipboard } from "../../app/App";
import { EventContext } from "../../Event";

/**
 * メタデータ編集ダイアログの共通ラッパー
 * ID表示+コピー、フォームGrid、Delete/Saveボタン、閉じるボタンを共通化
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   id?: string,
 *   showId?: boolean,
 *   onSave: () => void,
 *   onDelete?: () => void,
 *   showDelete?: boolean,
 *   deleteDisabled?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
function MetaDialog({
  open, onClose, title, id,
  showId = true,
  onSave,
  onDelete, showDelete = true, deleteDisabled = false,
  children,
}) {
  const evt = useContext(EventContext);

  const handleCopyId = () => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1 }}>{title}</span>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid className="formGrid" style={{ margin: "8px 0" }}>
          {showId && id && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" sx={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                ID: {id}
              </Typography>
              <IconButton size="small" onClick={handleCopyId} title="Copy ID">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Box>
          )}
          {children}
        </Grid>
      </DialogContent>
      <DialogActions>
        {showDelete && onDelete && (
          <IconButton onClick={onDelete} color="error" disabled={deleteDisabled} sx={{ mr: "auto" }} aria-label="delete">
            <Delete />
          </IconButton>
        )}
        <IconButton onClick={onSave} color="primary" aria-label="save">
          <Save />
        </IconButton>
      </DialogActions>
    </Dialog>
  );
}

export default MetaDialog;
