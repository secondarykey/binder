import { useState } from "react";
import {
  Checkbox, Dialog, DialogActions, DialogContentText, DialogTitle,
  FormControlLabel, Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import "../../language";
import { useTranslation } from 'react-i18next';

import { ActionButton } from './ActionButton';

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
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={onCancel} />
        <ActionButton variant="save" label={t("convert.confirm")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={onConfirm} />
      </DialogActions>
    </Dialog>
  );
}

/**
 * アプリ更新が必要な場合のダイアログ
 * @param {{ open: boolean, appVersion: string, binderVersion: string, onClose: () => void, onForceOpen: () => void }} props
 */
export function NeedUpdateDialog({ open, appVersion, binderVersion, onClose, onForceOpen }) {
  const {t} = useTranslation();
  const [forceOpen, setForceOpen] = useState(false);

  const handleClose = () => {
    setForceOpen(false);
    onClose();
  };

  const handleForceOpen = () => {
    setForceOpen(false);
    onForceOpen();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
      <FormControlLabel
        control={<Checkbox checked={forceOpen} onChange={(e) => setForceOpen(e.target.checked)} />}
        label={t("convert.forceOpen")}
        style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}
      />
      <DialogActions>
        {forceOpen
          ? <ActionButton variant="confirm" label={t("common.open")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleForceOpen} />
          : <ActionButton variant="cancel" label={t("common.ok")} icon={<CloseIcon />} onClick={handleClose} />
        }
      </DialogActions>
    </Dialog>
  );
}

export default ConvertDialog;
