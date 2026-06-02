import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Select, MenuItem, Switch, Typography, Tabs, Tab,
} from '@mui/material';

import { GetFont, SaveFont, SetTheme, SetLanguage, SaveEditorSettings, Version, OpenPreviewFiles } from '../bindings/binder/api/lite/app';
import { GetThemeList, GetLanguageList, GetFontNames, GetLicense, GetThirdPartyLicenses } from '../bindings/binder/api/shared/shared';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { setThemeMode } from './theme';
import { loadLanguage } from './language';
import FontDialog from '@shared/editor/FontDialog';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * lite 設定ダイアログ（タブ化：外観 / ライセンス）
 */
function SettingDialog({ open, onClose, settings, onSettingsSaved, onOpenFiles }) {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);

  // --- 外観タブ ---
  const [themes, setThemes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [fontNames, setFontNames] = useState([]);
  const [themeValue, setThemeValue] = useState('system');
  const [langValue, setLangValue] = useState('en');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [font, setFont] = useState(null);
  const [fontOpen, setFontOpen] = useState(false);

  // --- ライセンスタブ ---
  const [version, setVersion] = useState('');
  const [license, setLicense] = useState('');
  const [thirdParty, setThirdParty] = useState('');

  // ダイアログを開いた時に設定をロード
  useEffect(() => {
    if (!open) return;

    setTabIndex(0);
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
    GetFont(effectiveTheme).then(f => { if (f) setFont(f); }).catch(() => {});

    Version().then(v => setVersion(v || '')).catch(() => {});
    GetLicense().then(setLicense).catch(() => {});
    GetThirdPartyLicenses().then(setThirdParty).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // テーマ変更時にフォントを再読み込み
  const handleThemeChange = (e) => {
    const next = e.target.value;
    setThemeValue(next);
    const effectiveTheme = next === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : next;
    GetFont(effectiveTheme).then(f => { if (f) setFont(f); }).catch(() => {});
  };

  // 保存
  const handleSave = async () => {
    await SetTheme(themeValue).catch(() => {});
    setThemeMode(themeValue);
    await SetLanguage(langValue).catch(() => {});
    if (langValue !== settings.language) loadLanguage(langValue);
    await SaveEditorSettings(showLineNumbers, wordWrap).catch(() => {});
    if (font) {
      const effectiveTheme = themeValue === 'system'
        ? (document.documentElement.dataset.theme || 'dark')
        : themeValue;
      await SaveFont(effectiveTheme, font).catch(() => {});
    }
    onSettingsSaved({ themeMode: themeValue, language: langValue, showLineNumbers, wordWrap });
    onClose();
  };

  // プレビューファイルを開く
  const handleOpenPreviewFiles = async () => {
    const effectiveTheme = themeValue === 'system'
      ? (document.documentElement.dataset.theme || 'dark')
      : themeValue;
    try {
      const paths = await OpenPreviewFiles(effectiveTheme);
      if (paths && onOpenFiles) {
        onOpenFiles(paths);
        onClose();
      }
    } catch (err) {
      console.error('OpenPreviewFiles error:', err);
    }
  };

  const labelSx = { fontSize: '12px', color: 'var(--text-secondary)', minWidth: 80 };
  const rowSx = { display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            height: 500,
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '15px', pb: 0 }}>
          {t('lite.settingsTitle')}
        </DialogTitle>

        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{
            px: 3,
            minHeight: 36,
            '& .MuiTab-root': {
              color: 'var(--text-muted)',
              fontSize: '12px',
              minHeight: 36,
              textTransform: 'none',
              '&.Mui-selected': { color: 'var(--text-primary)' },
            },
            '& .MuiTabs-indicator': { backgroundColor: 'var(--accent-blue)' },
          }}
        >
          <Tab label={t('lite.tabAppearance')} />
          <Tab label={t('lite.tabLicense')} />
        </Tabs>

        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 外観タブ */}
          {tabIndex === 0 && (
            <Box>
              <Box sx={rowSx}>
                <Typography sx={labelSx}>{t('lite.themeLabel')}</Typography>
                <Select value={themeValue} onChange={handleThemeChange} size="small"
                  sx={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}>
                  <MenuItem value="system">{t('lite.theme.system')}</MenuItem>
                  {themes.map(th => <MenuItem key={th.id} value={th.id}>{th.name}</MenuItem>)}
                </Select>
              </Box>

              <Box sx={rowSx}>
                <Typography sx={labelSx}>{t('lite.languageLabel')}</Typography>
                <Select value={langValue} onChange={(e) => setLangValue(e.target.value)} size="small"
                  sx={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}>
                  {languages.map(l => <MenuItem key={l.code} value={l.code}>{l.name}</MenuItem>)}
                </Select>
              </Box>

              <Box sx={rowSx}>
                <Typography sx={labelSx}>{t('lite.lineNumbers')}</Typography>
                <Switch checked={showLineNumbers} onChange={(e) => setShowLineNumbers(e.target.checked)} size="small" />
              </Box>

              <Box sx={rowSx}>
                <Typography sx={labelSx}>{t('lite.wordWrap')}</Typography>
                <Switch checked={wordWrap} onChange={(e) => setWordWrap(e.target.checked)} size="small" />
              </Box>

              <Box sx={rowSx}>
                <Typography sx={labelSx}>{t('lite.fontLabel')}</Typography>
                <Button size="small" onClick={() => setFontOpen(true)}
                  sx={{ textTransform: 'none', fontSize: '12px', color: 'var(--text-primary)', border: '1px solid var(--border-input)', px: 2, '&:hover': { backgroundColor: 'var(--bg-elevated)' } }}>
                  {font ? `${font.name}, ${font.size}px` : '...'}
                </Button>
              </Box>

              {/* プレビュー */}
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', mt: 2, mb: 1 }}>
                {t('lite.previewLabel')}
              </Typography>
              <Box sx={rowSx}>
                <Typography sx={{ ...labelSx, fontSize: '11px' }}>{t('lite.previewDesc')}</Typography>
                <Button size="small" onClick={handleOpenPreviewFiles} startIcon={<FolderOpenIcon sx={{ fontSize: '14px' }} />}
                  sx={{ textTransform: 'none', fontSize: '12px', color: 'var(--text-primary)', border: '1px solid var(--border-input)', px: 2, flexShrink: 0, '&:hover': { backgroundColor: 'var(--bg-elevated)' } }}>
                  {t('lite.openPreviewFiles')}
                </Button>
              </Box>
            </Box>
          )}

          {/* ライセンスタブ */}
          {tabIndex === 1 && (
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Typography sx={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', mb: 2 }}>
                Binder Lite {version && `v${version}`}
              </Typography>

              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', mb: 0.5 }}>
                {t('lite.license')}
              </Typography>
              <Box sx={{
                whiteSpace: 'pre-wrap', fontSize: '11px', fontFamily: 'monospace',
                color: 'var(--text-secondary)', backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-primary)', borderRadius: 1, p: 2, mb: 2,
              }}>
                {license}
              </Box>

              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', mb: 0.5 }}>
                {t('lite.thirdPartyLicense')}
              </Typography>
              <Box sx={{
                whiteSpace: 'pre-wrap', fontSize: '11px', fontFamily: 'monospace',
                color: 'var(--text-secondary)', backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-primary)', borderRadius: 1, p: 2,
              }}>
                {thirdParty}
              </Box>
            </Box>
          )}

        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={onClose} size="small"
            sx={{ color: 'var(--text-secondary)', textTransform: 'none', fontSize: '12px', '&:hover': { backgroundColor: 'var(--bg-elevated)' } }}>
            {t('common.cancel')}
          </Button>
          {tabIndex === 0 && (
            <Button onClick={handleSave} size="small"
              sx={{ color: 'var(--accent-blue)', textTransform: 'none', fontSize: '12px', fontWeight: 600, '&:hover': { backgroundColor: 'var(--bg-elevated)' } }}>
              {t('common.save', 'Save')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <FontDialog
        open={fontOpen}
        font={font}
        fontNames={fontNames}
        title={t('lite.fontLabel')}
        okLabel="OK"
        sampleLabel={t('font.sample', 'Sample')}
        labels={{ name: t('lite.fontName'), size: t('lite.fontSize'), color: t('lite.fontColor'), backgroundColor: t('lite.fontBgColor') }}
        onSave={(f) => { setFont(f); setFontOpen(false); }}
        onClose={() => setFontOpen(false)}
      />
    </>
  );
}

export default SettingDialog;
