import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Window } from '@wailsio/runtime';

import './language';
import { useTranslation } from 'react-i18next';

const btnSx = { color: 'var(--text-muted)', borderRadius: 0, width: 32, height: 32, '&:hover': { color: 'var(--text-primary)' } };

const themeIcons = {
  system: <SettingsBrightnessIcon sx={{ fontSize: '16px' }} />,
  light:  <LightModeIcon sx={{ fontSize: '16px' }} />,
  dark:   <DarkModeIcon sx={{ fontSize: '16px' }} />,
};

/**
 * フレームレスウィンドウ用タイトルバー
 */
function TitleBar({ onClose, onOpen, onSave, hasActiveTab, themeMode, onThemeToggle }) {
  const { t } = useTranslation();

  const themeLabelKey = `lite.theme.${themeMode}`;

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
      {/* 左: タイトル + ファイル操作 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, '--wails-draggable': 'no-drag' }}>
        <Box sx={{ fontSize: '12px', color: 'var(--text-secondary)', pl: 1, pr: 1, '--wails-draggable': 'drag' }}>
          Binder Lite
        </Box>
        <IconButton size="small" onClick={onOpen} sx={btnSx} title="Open (Ctrl+O)">
          <FolderOpenIcon sx={{ fontSize: '16px' }} />
        </IconButton>
        <IconButton size="small" onClick={onSave} disabled={!hasActiveTab} sx={{ ...btnSx, '&.Mui-disabled': { color: 'var(--text-disabled)' } }} title="Save As">
          <SaveIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Box>

      {/* 右: テーマ切り替え + ウィンドウ操作 */}
      <Box sx={{ display: 'flex', '--wails-draggable': 'no-drag' }}>
        <Tooltip title={t(themeLabelKey)} placement="bottom">
          <IconButton size="small" onClick={onThemeToggle} sx={btnSx}>
            {themeIcons[themeMode]}
          </IconButton>
        </Tooltip>
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
