import { useEffect, useState, useContext } from "react";

import { Accordion, AccordionDetails, AccordionSummary, Box, FormControl, FormLabel, List, ListItemButton, ListItemText, Switch, TextField } from "@mui/material";
import { GetPath, SavePath } from "../../bindings/binder/api/app";

import { IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';

import { EventContext } from "../Event";
import SnippetSetting from "./SnippetSetting";

/**
 * アプリ設定
 * @param {*} props
 * @returns
 */
function Setting({ isModal, ...props }) {

  const evt = useContext(EventContext)

  const [activeSection, setActiveSection] = useState("basic");

  const [pathDefault, setPathDefault] = useState("");
  const [pathRunWith, setPathRunWith] = useState(true);
  const [pathOpenWith, setPathOpenWith] = useState(false);

  const [editorProgram, setEditorProgram] = useState("notepad {file}");
  const [editorGitBash, setEditorGitBash] = useState(false);
  const [editorFont, setEditorFont] = useState({});

  const [gitBranch, setGitBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");
  const [gitCode, setGitCode] = useState("");

  useEffect(() => {

    if (!isModal) evt.changeTitle("Setting")
    GetPath().then((p) => {

      setPathDefault(p.default);
      setPathRunWith(p.runWithOpen);
      setPathOpenWith(p.openWithItem);

      //setGitBranch(set.git.branch);
      //setGitName(set.git.name);
      //setGitMail(set.git.mail);
      //setGitCode(set.git.code);
      //setEditorProgram(set.lookAndFeel.editor.program);
      //setEditorGitBash(set.lookAndFeel.editor.gitBash);

    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, []);

  const handleSave = () => {

    var path = {};
    path.default = pathDefault;
    path.runWithOpen = pathRunWith;
    path.openWithItem = pathOpenWith;
    //setting.path = path;

    //var git = {};
    //git.branch = gitBranch;
    //git.name = gitName;
    //git.mail = gitMail;
    //git.code = gitCode;
    //setting.git = git;

    SavePath(path).then((resp) => {
      evt.showSuccessMessage("Updated");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const handleSwitch = (e, caller) => {
    caller(e.target.checked);
  }

  const menuItems = [
    { key: "basic", label: "基本設定" },
    { key: "snippet", label: "スニペット" },
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
          <div className="formGrid" style={{ margin: '20px 24px' }}>

            {/** ファイル処理全般 */}
            <Accordion defaultExpanded={true}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1-content" id="panel1-header"> Files </AccordionSummary>
              <AccordionDetails className="formContainer">
                {/** デフォルトパス保存先 */}
                <FormControl>
                  <FormLabel>Default Path</FormLabel>
                  <TextField size="small" value={pathDefault} onChange={(e) => setPathDefault(e.target.value)}></TextField>
                </FormControl>
                {/** 最後に開いたBinderを開くか */}
                <FormControl>
                  <FormLabel>Run with open Binder</FormLabel>
                  <Switch checked={pathRunWith} onChange={(e) => handleSwitch(e, setPathRunWith)} inputProps={{ 'aria-label': 'controlled' }} />
                </FormControl>
                {/** 起動時に最後に開いたファイルを開くか？ */}
                <FormControl>
                  <FormLabel>Open with note(or data)</FormLabel>
                  <Switch checked={pathOpenWith} disabled={!pathRunWith} onChange={(e) => handleSwitch(e, setPathOpenWith)} inputProps={{ 'aria-label': 'controlled' }} />
                </FormControl>
              </AccordionDetails>
            </Accordion>

            {/** エディタ設定 */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1-content">Editor</AccordionSummary>
              <AccordionDetails className="formContainer">
                {/** エディタパス */}
                <FormControl>
                  <FormLabel>
                  Editor Program
                  </FormLabel>
                  <TextField size="small" value={editorProgram} onChange={(e) => setEditorProgram(e.target.value)}></TextField>
                </FormControl>
              </AccordionDetails>
            </Accordion>

            {/** 認証情報 */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1-content">Git</AccordionSummary>
              <AccordionDetails className="formContainer">
                {/** デフォルトのブランチ名 */}
                <FormControl>
                  <FormLabel>Default Branch Name</FormLabel>
                  <TextField size="small" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)}></TextField>
                </FormControl>
                {/** ユーザ名 */}
                <FormControl>
                  <FormLabel>Name</FormLabel>
                  <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)}></TextField>
                </FormControl>
                {/** メールアドレス */}
                <FormControl>
                  <FormLabel>Mail</FormLabel>
                  <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)}></TextField>
                </FormControl>
              </AccordionDetails>
            </Accordion>

            {/** 保存 */}
            <IconButton className="saveBtn" onClick={handleSave} aria-label="save">
              <SaveIcon fontSize="large" color="primary" />
            </IconButton>

          </div>
        )}

        {activeSection === "snippet" && (
          <SnippetSetting />
        )}

      </Box>

    </Box>
  );
}
export default Setting;
