import { Dialog, DialogActions, DialogContentText, DialogTitle, Button } from '@mui/material';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * 汎用確認ダイアログ
 * open / message / onCancel / onConfirm を受け取る
 */
function ConfirmDialog({ open, message, onCancel, onConfirm }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{
        style: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          minWidth: 360,
          minHeight: 130,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ fontSize: '15px', pb: 0.5 }}>
        {t('lite.confirmTitle')}
      </DialogTitle>
      <DialogContentText sx={{ px: 3, pb: 1, color: 'var(--text-secondary)', fontSize: '13px', flex: 1 }}>
        {message}
      </DialogContentText>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onCancel}
          size="small"
          sx={{
            color: 'var(--text-secondary)',
            textTransform: 'none',
            fontSize: '12px',
            '&:hover': { backgroundColor: 'var(--bg-elevated)' },
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          size="small"
          sx={{
            color: 'var(--accent-red)',
            textTransform: 'none',
            fontSize: '12px',
            fontWeight: 600,
            '&:hover': { backgroundColor: 'var(--bg-elevated)' },
          }}
        >
          {t('lite.discard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
