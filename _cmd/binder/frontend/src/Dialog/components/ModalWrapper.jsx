import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * フルスクリーンモーダルのラッパー
 * Toolbar（タイトル+閉じるボタン）+ children のレイアウトを共通化
 * @param {{ open: boolean, onClose: () => void, title: string, width?: string, height?: string, maxWidth?: string, maxHeight?: string, children: React.ReactNode }} props
 */
function ModalWrapper({ open, onClose, title, width = "1000px", height = "75vh", maxWidth, maxHeight, children }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          width,
          height,
          maxWidth: maxWidth || undefined,
          maxHeight: maxHeight || height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
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
        <Typography variant="body1" sx={{ flex: 1 }}>{title}</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </Dialog>
  );
}

export default ModalWrapper;
