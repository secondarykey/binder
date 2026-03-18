import { useContext } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Typography,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import { copyClipboard } from "../../App";
import { EventContext } from "../../Event";

/**
 * メタデータ編集ダイアログの共通ラッパー
 * ID表示+コピー、フォームGrid、Delete/Cancel/Saveボタンを共通化
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   id?: string,
 *   showId?: boolean,
 *   onSave: () => void,
 *   saveLabel?: string,
 *   onDelete?: () => void,
 *   showDelete?: boolean,
 *   deleteDisabled?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
function MetaDialog({
  open, onClose, title, id,
  showId = true,
  onSave, saveLabel = "Save",
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
      <DialogTitle>{title}</DialogTitle>
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
          <Button onClick={onDelete} color="error" disabled={deleteDisabled}>Delete</Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained">{saveLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default MetaDialog;
