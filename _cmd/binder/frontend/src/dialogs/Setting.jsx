import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, FormControlLabel, IconButton, InputAdornment, List, ListItemButton, ListItemText, MenuItem, Paper, Select, Switch, TextField } from "@mui/material";
import { GetPath, SavePath, GetTheme, SetTheme, GetLanguage, SetLanguage, GetFont, GetThemeList, GetLanguageList } from "../../bindings/binder/api/app";
import { Events } from '@wailsio/runtime';
import { OpenFileDialog, OpenSyslogWindow } from "../../bindings/main/window";
import SaveIcon from '@mui/icons-material/Save';
import FolderIcon from '@mui/icons-material/Folder';
import TerminalIcon from '@mui/icons-material/Terminal';

import { EventContext } from "../Event";
import SnippetSetting from "./SnippetSetting";
import EditorSetting from "./EditorSetting";
import GitSetting from "./GitSetting";
import LicenseSetting from "./LicenseSetting";
import "../i18n/config";
import { useTranslation } from 'react-i18next';
import { applyTheme } from '../theme';
import { loadLanguage } from '../i18n/config';

/**
 * アプリ設定
 * @param {*} props
 * @returns
 */
function Setting({ isModal, ...props }) {

  const evt = useContext(EventContext)
  const {t, i18n} = useTranslation();

  const [activeSection, setActiveSection] = useState("basic");

  const [pathDefault, setPathDefault] = useState("");
  const [pathRunWith, setPathRunWith] = useState(true);
  const [pathOpenWith, setPathOpenWith] = useState(false);
  const [theme, setThemeState] = useState(
    document.documentElement.dataset.theme || 'dark'
  );
  const [themeList, setThemeList] = useState([]);
  const [langList, setLangList] = useState([]);

  useEffect(() => {

    if (!isModal) evt.changeTitle(t("setting.title"))
    GetPath().then((p) => {

      setPathDefault(p.default);
      setPathRunWith(p.runWithOpen);
      setPathOpenWith(p.openWithItem);

    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    GetTheme().then((t) => {
      setThemeState(t || 'dark');
    }).catch(() => {});
    GetLanguage().then((lang) => {
      if (lang) i18n.changeLanguage(lang);
    }).catch(() => {});

    // テーマ・言語の一覧を動的に取得
    GetThemeList().then((list) => {
      setThemeList(list || []);
    }).catch(() => {});
    GetLanguageList().then((list) => {
      setLangList(list || []);
    }).catch(() => {});
  }, []);

  const handleThemeChange = (e) => {
    const next = e.target.value;
    setThemeState(next);
    applyTheme(next);
    SetTheme(next).then(() => {
      // テーマ変更後にそのテーマのフォント設定を取得して全画面に通知
      GetFont().then((f) => {
        if (f) Events.Emit('binder:editor:fontChanged', f);
      }).catch(() => {});
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    loadLanguage(lang);
    SetLanguage(lang).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleSave = () => {

    var path = {};
    path.default = pathDefault;
    path.runWithOpen = pathRunWith;
    path.openWithItem = pathOpenWith;

    SavePath(path).then((resp) => {
      evt.showSuccessMessage(t("common.updated"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const handleSelectDefaultPath = () => {
    OpenFileDialog(false, pathDefault).then((dir) => {
      if (dir) setPathDefault(dir);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleSwitch = (e, caller) => {
    caller(e.target.checked);
  }

  const menuItems = [
    { key: "basic", label: t("setting.basic") },
    { key: "editor", label: t("setting.editor") },
    { key: "snippet", label: t("setting.snippet") },
    { key: "git", label: t("setting.git") },
    { key: "license", label: t("setting.license") },
  ];

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** 左サイドナビ */}
      <List disablePadding sx={{
        width: 120,
        flexShrink: 0,
        borderRight: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-dialog)',
        pt: 1,
      }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.key}
            selected={activeSection === item.key}
            onClick={() => setActiveSection(item.key)}
            sx={{
              py: 1,
              px: 1.5,
              fontSize: '13px',
              '&.Mui-selected': {
                backgroundColor: 'var(--selected-menu)',
                color: 'var(--selected-text)',
              },
              '&.Mui-selected:hover': {
                backgroundColor: 'var(--selected-menu)',
              },
              '&:hover': {
                backgroundColor: 'var(--bg-elevated)',
              },
            }}
          >
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '13px' }}
            />
          </ListItemButton>
        ))}
      </List>

      {/** 右コンテンツ */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {activeSection === "basic" && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="formGrid" style={{ margin: '20px 24px', flex: 1 }}>
              <div className="formContainer">
                {/** 言語選択 */}
                <FormControl>
                  <FormLabel>{t("setting.language")}</FormLabel>
                  <Select
                    value={i18n.language}
                    onChange={handleLanguageChange}
                    size="small"
                    sx={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-dropdown)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
                      '& .MuiSvgIcon-root': { color: 'var(--text-muted)' },
                    }}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
                  >
                    {langList.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code} sx={{ fontSize: '13px' }}>{lang.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {/** テーマ選択 */}
                <FormControl>
                  <FormLabel>{t("setting.theme")}</FormLabel>
                  <Select
                    value={theme}
                    onChange={handleThemeChange}
                    size="small"
                    sx={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-dropdown)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
                      '& .MuiSvgIcon-root': { color: 'var(--text-muted)' },
                    }}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
                  >
                    {themeList.map((t) => (
                      <MenuItem key={t.id} value={t.id} sx={{ fontSize: '13px' }}>{t.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {/** デフォルトパス保存先 */}
                <FormControl>
                  <FormLabel>{t("setting.defaultPath")}</FormLabel>
                  <TextField
                    size="small"
                    value={pathDefault}
                    onClick={handleSelectDefaultPath}
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <FolderIcon sx={{ color: 'var(--text-muted)', fontSize: '20px' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ cursor: 'pointer', '& input': { cursor: 'pointer' } }}
                  />
                </FormControl>
                {/** 起動時の動作 */}
                <Paper variant="outlined" sx={{
                  p: 2,
                  backgroundColor: 'var(--bg-overlay)',
                  borderColor: 'var(--border-primary)',
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 3,
                }}>
                  <FormControlLabel
                    control={
                      <Switch checked={pathRunWith} onChange={(e) => handleSwitch(e, setPathRunWith)} size="small" />
                    }
                    label={t("setting.runWithOpen")}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', color: 'var(--text-primary)' } }}
                  />
                  <FormControlLabel
                    control={
                      <Switch checked={pathOpenWith} disabled={!pathRunWith} onChange={(e) => handleSwitch(e, setPathOpenWith)} size="small" />
                    }
                    label={t("setting.openWithNote")}
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: '13px',
                        color: pathRunWith ? 'var(--text-primary)' : 'var(--text-disabled)',
                      },
                    }}
                  />
                </Paper>
                {/** システムログ */}
                <FormControl>
                  <FormLabel>{t("setting.systemLog")}</FormLabel>
                  <IconButton
                    onClick={() => OpenSyslogWindow().catch((err) => evt.showErrorMessage(err))}
                    sx={{
                      width: 'fit-content',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-input)',
                      borderRadius: '4px',
                      px: 2,
                      py: 0.5,
                      fontSize: '13px',
                      gap: 1,
                    }}
                  >
                    <TerminalIcon fontSize="small" />
                    <span style={{ fontSize: '13px' }}>{t("setting.openSystemLog")}</span>
                  </IconButton>
                </FormControl>
              </div>
            </div>

            {/** 保存 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSave} aria-label="save" sx={{ color: '#fff', backgroundColor: 'var(--accent-blue)', '&:hover': { backgroundColor: 'var(--accent-blue)', opacity: 0.85 } }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>
          </Box>
        )}

        {activeSection === "editor" && (
          <EditorSetting />
        )}

        {activeSection === "git" && (
          <GitSetting />
        )}

        {activeSection === "snippet" && (
          <SnippetSetting />
        )}

        {activeSection === "license" && (
          <LicenseSetting />
        )}

      </Box>

    </Box>
  );
}
export default Setting;
