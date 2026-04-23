import {
  Dialog, DialogActions, DialogContentText, DialogTitle,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";

import "../../language";
import { useTranslation } from 'react-i18next';

import { ActionButton } from './ActionButton';

/**
 * 確認ダイアログ（削除確認などに使用）
 * @param {{ open: boolean, title: string, message: string, onCancel: () => void, onConfirm: () => void }} props
 */
function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  const {t} = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", minWidth: 400, minHeight: 300 } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        {message}
      </DialogContentText>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={onCancel} />
        <ActionButton variant="delete" label={t("common.delete")} icon={<DeleteIcon />} onClick={onConfirm} />
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
