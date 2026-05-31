import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Select, MenuItem, Switch, Typography,
} from '@mui/material';

import { GetThemeList, GetLanguageList, GetFont, SaveFont, GetFontNames, SetTheme, SetLanguage, SaveEditorSettings } from '../bindings/binder/api/lite/app';
import { setThemeMode } from './theme';
import { loadLanguage } from './language';
import FontDialog from '@shared/editor/FontDialog';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * lite 設定ダイアログ（まとめて保存方式）
 */
function SettingDialog({ open, onClose, settings, onSettingsSaved }) {
  const { t } = useTranslation();

  const [themes, setThemes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [fontNames, setFontNames] = useState([]);

  // ローカル state（保存ボタンで確定）
  const [themeValue, setThemeValue] = useState('system');
  const [langValue, setLangValue] = useState('en');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [font, setFont] = useState(null);

  // フォントダイアログ
  const [fontOpen, setFontOpen] = useState(false);

  // ダイアログを開いた時に現在の設定をローカル state にコピー
  useEffect(() => {
    if (!open) return;

    setThemeValue(settings.themeMode);
    setLangValue(settings.language || 'en');
    setShowLineNumbers(settings.showLineNumbers);
    setWordWrap(settings.wordWrap);

    GetThemeList().then(setThemes).catch(() => {});
    GetLanguageList().then(setLanguages).catch(() => {});
    GetFontNames().then(names => setFontNames(names || [])).catch(() => {});

    const effectiveTheme = settings.themeMode === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : settings.themeMode;
    GetFont(effectiveTheme).then(f => {
      if (f) setFont(f);
    }).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // テーマ変更時にフォント設定を読み込み直す
  const handleThemeChange = (e) => {
    const next = e.target.value;
    setThemeValue(next);
    const effectiveTheme = next === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : next;
    GetFont(effectiveTheme).then(f => {
      if (f) setFont(f);
    }).catch(() => {});
  };

  // 保存
  const handleSave = async () => {
    // テーマ
    await SetTheme(themeValue).catch(() => {});
    setThemeMode(themeValue);

    // 言語
    await SetLanguage(langValue).catch(() => {});
    if (langValue !== settings.language) {
      loadLanguage(langValue);
    }

    // エディタ設定
    await SaveEditorSettings(showLineNumbers, wordWrap).catch(() => {});

    // フォント
    if (font) {
      const effectiveTheme = themeValue === 'system'
        ? (document.documentElement.dataset.theme || 'dark')
        : themeValue;
      await SaveFont(effectiveTheme, font).catch(() => {});
    }

    // 親に通知
    onSettingsSaved({
      themeMode: themeValue,
      language: langValue,
      showLineNumbers,
      wordWrap,
    });
    onClose();
  };

  // キャンセル（変更を破棄）
  const handleCancel = () => {
    onClose();
  };

  const labelSx = { fontSize: '12px', color: 'var(--text-secondary)', minWidth: 80 };
  const rowSx = { display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCancel}
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
              onChange={(e) => setLangValue(e.target.value)}
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
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
              size="small"
            />
          </Box>

          {/* 折り返し */}
          <Box sx={rowSx}>
            <Typography sx={labelSx}>{t('lite.wordWrap')}</Typography>
            <Switch
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
              size="small"
            />
          </Box>

          {/* フォント */}
          <Box sx={rowSx}>
            <Typography sx={labelSx}>{t('lite.fontLabel')}</Typography>
            <Button
              size="small"
              onClick={() => setFontOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '12px',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-input)',
                px: 2,
                '&:hover': { backgroundColor: 'var(--bg-elevated)' },
              }}
            >
              {font ? `${font.name}, ${font.size}px` : '...'}
            </Button>
          </Box>

        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button
            onClick={handleCancel}
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
            onClick={handleSave}
            size="small"
            sx={{
              color: 'var(--accent-blue)',
              textTransform: 'none',
              fontSize: '12px',
              fontWeight: 600,
              '&:hover': { backgroundColor: 'var(--bg-elevated)' },
            }}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <FontDialog
        open={fontOpen}
        font={font}
        fontNames={fontNames}
        title={t('lite.fontLabel')}
        okLabel="OK"
        sampleLabel={t('font.sample', 'Sample')}
        labels={{
          name: t('lite.fontName'),
          size: t('lite.fontSize'),
          color: t('lite.fontColor'),
          backgroundColor: t('lite.fontBgColor'),
        }}
        onSave={(f) => { setFont(f); setFontOpen(false); }}
        onClose={() => setFontOpen(false)}
      />
    </>
  );
}

export default SettingDialog;
