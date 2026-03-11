import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import Binder from './contents/Binder';

/**
 * バインダー編集モーダル
 */
function BinderModal({ open, onClose }) {
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
        <Typography variant="body1" sx={{ flex: 1 }}>Edit Binder</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <Binder isModal />
    </Dialog>
  );
}

export default BinderModal;
