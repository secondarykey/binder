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
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#252525',
          color: '#f1f1f1',
          maxHeight: '85vh',
        }
      }}
    >
      <Toolbar sx={{
        minHeight: '40px !important',
        paddingLeft: '16px !important',
        paddingRight: '0px',
        color: '#f1f1f1',
        borderBottom: '1px solid #262626',
        backgroundColor: '#1c1c1c',
        flexShrink: 0,
      }}>
        <Typography variant="body1" sx={{ flex: 1 }}>Setting</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <Setting isModal />
    </Dialog>
  );
}

export default SettingModal;
