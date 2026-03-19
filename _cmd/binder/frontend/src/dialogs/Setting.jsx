import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, FormControlLabel, IconButton, List, ListItemButton, ListItemText, MenuItem, Paper, Select, Switch, TextField } from "@mui/material";
import { GetPath, SavePath, GetTheme, SetTheme } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';

import { EventContext } from "../Event";
import SnippetSetting from "./SnippetSetting";
import EditorSetting from "./EditorSetting";
import GitSetting from "./GitSetting";
import "../i18n/config";
import { useTranslation } from 'react-i18next';
import locals from "../i18n/locals.json";

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
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

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
  }, []);

  const handleThemeChange = (e) => {
    const next = e.target.value;
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    SetTheme(next).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value);
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

  const handleSwitch = (e, caller) => {
    caller(e.target.checked);
  }

  const menuItems = [
    { key: "basic", label: t("setting.basic") },
    { key: "editor", label: t("setting.editor") },
    { key: "git", label: t("setting.git") },
    { key: "snippet", label: t("setting.snippet") },
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
                {/** デフォルトパス保存先 */}
                <FormControl>
                  <FormLabel>{t("setting.defaultPath")}</FormLabel>
                  <TextField size="small" value={pathDefault} onChange={(e) => setPathDefault(e.target.value)}></TextField>
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
                    <MenuItem value="dark" sx={{ fontSize: '13px' }}>{t("setting.themeDark")}</MenuItem>
                    <MenuItem value="light" sx={{ fontSize: '13px' }}>{t("setting.themeLight")}</MenuItem>
                  </Select>
                </FormControl>
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
                    {locals.languages.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code} sx={{ fontSize: '13px' }}>{lang.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </div>

            {/** 保存 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSave} aria-label="save" sx={{ color: 'var(--accent-blue)' }}>
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

      </Box>

    </Box>
  );
}
export default Setting;
