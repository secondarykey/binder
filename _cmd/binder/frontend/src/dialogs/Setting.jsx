import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, IconButton, List, ListItemButton, ListItemText, Switch, TextField } from "@mui/material";
import { GetPath, SavePath } from "../../bindings/binder/api/app";
import SaveIcon from '@mui/icons-material/Save';

import { EventContext } from "../Event";
import SnippetSetting from "./SnippetSetting";
import EditorSetting from "./EditorSetting";
import GitSetting from "./GitSetting";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * アプリ設定
 * @param {*} props
 * @returns
 */
function Setting({ isModal, ...props }) {

  const evt = useContext(EventContext)
  const {t} = useTranslation();

  const [activeSection, setActiveSection] = useState("basic");

  const [pathDefault, setPathDefault] = useState("");
  const [pathRunWith, setPathRunWith] = useState(true);
  const [pathOpenWith, setPathOpenWith] = useState(false);

  useEffect(() => {

    if (!isModal) evt.changeTitle(t("setting.title"))
    GetPath().then((p) => {

      setPathDefault(p.default);
      setPathRunWith(p.runWithOpen);
      setPathOpenWith(p.openWithItem);

    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, []);

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
                {/** 最後に開いたBinderを開くか */}
                <FormControl>
                  <FormLabel>{t("setting.runWithOpen")}</FormLabel>
                  <Switch checked={pathRunWith} onChange={(e) => handleSwitch(e, setPathRunWith)} inputProps={{ 'aria-label': 'controlled' }} />
                </FormControl>
                {/** 起動時に最後に開いたファイルを開くか？ */}
                <FormControl>
                  <FormLabel>{t("setting.openWithNote")}</FormLabel>
                  <Switch checked={pathOpenWith} disabled={!pathRunWith} onChange={(e) => handleSwitch(e, setPathOpenWith)} inputProps={{ 'aria-label': 'controlled' }} />
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
