import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import Setting from './contents/Setting';

/**
 * 設定モーダル
 */
function SettingModal({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          width: '1000px',
          height: '75vh',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Toolbar sx={{
        minHeight: '40px !important',
        paddingLeft: '16px !important',
        paddingRight: '0px',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-titlebar)',
        flexShrink: 0,
      }}>
        <Typography variant="body1" sx={{ flex: 1 }}>Setting</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Setting isModal />
      </div>
    </Dialog>
  );
}

export default SettingModal;
