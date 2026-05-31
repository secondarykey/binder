import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, TextField, Select, MenuItem, Switch, FormControlLabel, Typography,
} from '@mui/material';

import { GetThemeList, GetLanguageList, GetFont, SaveFont, SetTheme, SetLanguage } from '../bindings/binder/api/lite/app';
import { setThemeMode } from './theme';
import { loadLanguage } from './language';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * lite 設定ダイアログ
 */
function SettingDialog({ open, onClose, settings, onSettingsChange }) {
  const { t } = useTranslation();

  const [themes, setThemes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [themeValue, setThemeValue] = useState('system');
  const [langValue, setLangValue] = useState('en');
  const [font, setFont] = useState({ name: 'monospace', size: 14, color: '#e0e0e0', backgroundColor: '#1e1e1e' });

  // ダイアログを開いた時に現在の設定を読み込む
  useEffect(() => {
    if (!open) return;

    setThemeValue(settings.themeMode);
    setLangValue(settings.language || 'en');

    GetThemeList().then(setThemes).catch(() => {});
    GetLanguageList().then(setLanguages).catch(() => {});

    const effectiveTheme = settings.themeMode === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : settings.themeMode;
    GetFont(effectiveTheme).then(f => {
      if (f) setFont(f);
    }).catch(() => {});
  }, [open, settings.themeMode, settings.language]);

  // テーマ変更
  const handleThemeChange = (e) => {
    const next = e.target.value;
    setThemeValue(next);
    setThemeMode(next);
    SetTheme(next).catch(() => {});
    onSettingsChange({ themeMode: next });

    // テーマ変更後にフォント設定を読み込み直す
    const effectiveTheme = next === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : next;
    GetFont(effectiveTheme).then(f => {
      if (f) setFont(f);
    }).catch(() => {});
  };

  // 言語変更
  const handleLangChange = (e) => {
    const next = e.target.value;
    setLangValue(next);
    SetLanguage(next).catch(() => {});
    loadLanguage(next);
    onSettingsChange({ language: next });
  };

  // フォント変更（即保存）
  const updateFont = (key, value) => {
    const newFont = { ...font, [key]: value };
    setFont(newFont);
    const effectiveTheme = themeValue === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : themeValue;
    SaveFont(effectiveTheme, newFont).catch(() => {});
  };

  const labelSx = { fontSize: '12px', color: 'var(--text-secondary)', minWidth: 80 };
  const rowSx = { display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        style: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        },
      }}
    >
      <DialogTitle sx={{ fontSize: '15px', pb: 1 }}>
        {t('lite.settingsTitle')}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>

        {/* テーマ */}
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.themeLabel')}</Typography>
          <Select
            value={themeValue}
            onChange={handleThemeChange}
            size="small"
            sx={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
          >
            <MenuItem value="system">{t('lite.theme.system')}</MenuItem>
            {themes.map(th => (
              <MenuItem key={th.id} value={th.id}>{th.name}</MenuItem>
            ))}
          </Select>
        </Box>

        {/* 言語 */}
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.languageLabel')}</Typography>
          <Select
            value={langValue}
            onChange={handleLangChange}
            size="small"
            sx={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
          >
            {languages.map(l => (
              <MenuItem key={l.code} value={l.code}>{l.name}</MenuItem>
            ))}
          </Select>
        </Box>

        {/* 行番号 */}
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.lineNumbers')}</Typography>
          <Switch
            checked={settings.showLineNumbers}
            onChange={(e) => onSettingsChange({ showLineNumbers: e.target.checked })}
            size="small"
          />
        </Box>

        {/* 折り返し */}
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.wordWrap')}</Typography>
          <Switch
            checked={settings.wordWrap}
            onChange={(e) => onSettingsChange({ wordWrap: e.target.checked })}
            size="small"
          />
        </Box>

        {/* フォント設定 */}
        <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)', mt: 2, mb: 1, fontWeight: 600 }}>
          {t('lite.fontLabel')}
        </Typography>

        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.fontName')}</Typography>
          <TextField
            value={font.name}
            onChange={(e) => updateFont('name', e.target.value)}
            size="small"
            variant="outlined"
            sx={{ flex: 1, '& input': { fontSize: '13px', color: 'var(--text-primary)', py: 0.75 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
          />
        </Box>

        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.fontSize')}</Typography>
          <TextField
            type="number"
            value={font.size}
            onChange={(e) => updateFont('size', parseInt(e.target.value) || 14)}
            size="small"
            variant="outlined"
            inputProps={{ min: 8, max: 32 }}
            sx={{ width: 80, '& input': { fontSize: '13px', color: 'var(--text-primary)', py: 0.75 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
          />
        </Box>

        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.fontColor')}</Typography>
          <input
            type="color"
            value={font.color}
            onChange={(e) => updateFont('color', e.target.value)}
            style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
          />
          <Typography sx={{ fontSize: '12px', color: 'var(--text-muted)' }}>{font.color}</Typography>
        </Box>

        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t('lite.fontBgColor')}</Typography>
          <input
            type="color"
            value={font.backgroundColor}
            onChange={(e) => updateFont('backgroundColor', e.target.value)}
            style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
          />
          <Typography sx={{ fontSize: '12px', color: 'var(--text-muted)' }}>{font.backgroundColor}</Typography>
        </Box>

      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          size="small"
          sx={{
            color: 'var(--text-secondary)',
            textTransform: 'none',
            fontSize: '12px',
            '&:hover': { backgroundColor: 'var(--bg-elevated)' },
          }}
        >
          {t('lite.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingDialog;
