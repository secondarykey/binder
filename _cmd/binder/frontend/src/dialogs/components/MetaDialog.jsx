import { useContext, useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Typography,
} from "@mui/material";
import { Close, ContentCopy, Delete, Save } from "@mui/icons-material";
import { useTranslation } from 'react-i18next';
import "../../language";

import { copyClipboard } from "../../app/App";
import { EventContext } from "../../Event";
import { DialogErrorContext } from "./DialogError";

/**
 * メタデータ編集ダイアログの共通ラッパー
 * ID表示+コピー、フォームGrid、Delete/Saveボタン、閉じるボタンを共通化
 * DialogErrorContext を提供し、子コンポーネントのエラーをインライン Alert で表示する
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   id?: string,
 *   showId?: boolean,
 *   isPrivate?: boolean,
 *   onPrivateChange?: (value: boolean) => void,
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
  isPrivate, onPrivateChange,
  onSave,
  onDelete, showDelete = true, deleteDisabled = false,
  children,
}) {
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [dialogMsg, setDialogMsg] = useState(null);

  useEffect(() => {
    if (!open) setDialogMsg(null);
  }, [open]);

  const handleCopyId = () => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  };

  const ctxValue = { setMsg: setDialogMsg, clearMsg: () => setDialogMsg(null) };

  return (
    <DialogErrorContext.Provider value={ctxValue}>
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") return;
          onClose();
        }}
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
          {dialogMsg && (
            <Alert severity={dialogMsg.severity} onClose={() => setDialogMsg(null)}
              sx={{ mb: 1, fontSize: '13px' }}>
              {dialogMsg.text}
            </Alert>
          )}
          <Grid className="formGrid" style={{ margin: 0, padding: "8px" }}>
            {showId && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  ID: {id}
                </Typography>
                <IconButton size="small" onClick={handleCopyId} title="Copy ID">
                  <ContentCopy fontSize="small" />
                </IconButton>
                {onPrivateChange !== undefined && (
                  <Box sx={{ ml: "auto", display: "flex", alignItems: "center" }}>
                    <Checkbox
                      size="small"
                      checked={!!isPrivate}
                      onChange={(e) => onPrivateChange(e.target.checked)}
                      sx={{ p: 0.5 }}
                    />
                    <Typography variant="body2">{t("common.private")}</Typography>
                  </Box>
                )}
              </Box>
            )}
            {children}
          </Grid>
        </DialogContent>
        <DialogActions>
          {showDelete && onDelete && (
            <IconButton onClick={onDelete} disabled={deleteDisabled} sx={{ mr: "auto" }} aria-label="delete">
              <Delete style={{ color: deleteDisabled ? undefined : "var(--accent-red)" }} />
            </IconButton>
          )}
          <IconButton onClick={onSave} aria-label="save">
            <Save style={{ color: "var(--accent-blue)" }} />
          </IconButton>
        </DialogActions>
      </Dialog>
    </DialogErrorContext.Provider>
  );
}

export default MetaDialog;
