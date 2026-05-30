import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { Window } from '@wailsio/runtime';

/**
 * フレームレスウィンドウ用タイトルバー
 */
function TitleBar({ onClose }) {
  return (
    <Box
      sx={{
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-titlebar)',
        borderBottom: '1px solid var(--border-primary)',
        px: 1,
        '--wails-draggable': 'drag',
        cursor: 'default',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <Box sx={{ fontSize: '12px', color: 'var(--text-secondary)', pl: 1 }}>
        Binder Lite
      </Box>
      <Box sx={{ display: 'flex', '--wails-draggable': 'no-drag' }}>
        <IconButton size="small" onClick={() => Window.Minimise()} sx={{ color: 'var(--text-muted)', borderRadius: 0, width: 32, height: 32 }}>
          <MinimizeIcon sx={{ fontSize: '16px' }} />
        </IconButton>
        <IconButton size="small" onClick={() => Window.Maximise()} sx={{ color: 'var(--text-muted)', borderRadius: 0, width: 32, height: 32 }}>
          <CropSquareIcon sx={{ fontSize: '14px' }} />
        </IconButton>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-muted)', borderRadius: 0, width: 32, height: 32, '&:hover': { backgroundColor: 'var(--accent-red)', color: '#fff' } }}>
          <CloseIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default TitleBar;
