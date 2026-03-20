import {
  Button, Dialog, DialogActions, DialogContentText, DialogTitle,
} from "@mui/material";

import "../../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * データ移行確認ダイアログ
 * @param {{ open: boolean, onCancel: () => void, onConfirm: () => void }} props
 */
function ConvertDialog({ open, onCancel, onConfirm }) {
  const {t} = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>{t("convert.title")}</DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        {t("convert.message")}
      </DialogContentText>
      <DialogActions>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button color="primary" variant="contained" onClick={onConfirm}>{t("convert.confirm")}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConvertDialog;
