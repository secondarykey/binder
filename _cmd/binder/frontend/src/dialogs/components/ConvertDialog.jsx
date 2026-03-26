import {
  Button, Dialog, DialogActions, DialogContentText, DialogTitle,
  Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import "../../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * データ移行確認ダイアログ
 * @param {{ open: boolean, appVersion: string, binderVersion: string, onCancel: () => void, onConfirm: () => void }} props
 */
function ConvertDialog({ open, appVersion, binderVersion, onCancel, onConfirm }) {
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
      {appVersion && binderVersion && (
        <Typography variant="body2" style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
          {t("convert.versionInfo", { appVersion, binderVersion })}
        </Typography>
      )}
      <DialogActions>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button color="primary" variant="contained" onClick={onConfirm}>{t("convert.confirm")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * アプリ更新が必要な場合のダイアログ
 * @param {{ open: boolean, appVersion: string, binderVersion: string, onClose: () => void }} props
 */
export function NeedUpdateDialog({ open, appVersion, binderVersion, onClose }) {
  const {t} = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ErrorOutlineIcon color="error" />
        {t("convert.needUpdateTitle")}
      </DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        {t("convert.needUpdateMessage")}
      </DialogContentText>
      <Typography variant="body2" style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        {t("convert.needUpdateVersionInfo", { appVersion, binderVersion })}
      </Typography>
      <DialogActions>
        <Button onClick={onClose}>{t("common.ok")}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConvertDialog;
