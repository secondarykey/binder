import { useEffect, useState } from "react";

import { Accordion, AccordionDetails, AccordionSummary, Button, FormControl, FormLabel, Grid, Switch, TextField } from "@mui/material";
import { GetSetting, SaveSetting } from "../../wailsjs/go/api/App";

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Event from "../Event";
import Message from '../Message';

/**
 * アプリ設定
 * @param {*} props 
 * @returns 
 */
function Setting(props) {

  const [pathDefault, setPathDefault] = useState("");
  const [pathRunWith, setPathRunWith] = useState(true);
  const [pathOpenWith, setPathOpenWith] = useState(false);

  const [gitBranch, setGitBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");
  const [gitCode, setGitCode] = useState("");

  useEffect(() => {
    Event.changeTitle("Setting")
    GetSetting().then((set) => {
      setPathDefault(set.path.default);
      setPathRunWith(set.path.runWithOpen);
      setPathOpenWith(set.path.openWithItem);
      setGitBranch(set.git.branch);
      setGitName(set.git.name);
      setGitMail(set.git.mail);
      setGitCode(set.git.code);
    }).catch((err) => {
      Message.showError(err);
    });
  }, []);

  const handleSave = () => {

    var setting = {};
    var path = {};
    path.default = pathDefault;
    path.runWithOpen = pathRunWith;
    path.openWithItem = pathOpenWith;
    setting.path = path;
    var git = {};
    git.branch = gitBranch;
    git.name = gitName;
    git.mail = gitMail;
    git.code = gitCode;
    setting.git = git;

    SaveSetting(setting).then((resp) => {
      Message.showSuccess("Updated");
    }).catch((err) => {
      Message.showError(err);
    });
  }

  const handleSwitch = (e, caller) => {
    caller(e.target.checked);
  }

  return (<>
    <Grid className="formGrid">

      {/** ファイル処理全般 */}
      <Accordion defaultExpanded={true}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content" id="panel1-header"> Files </AccordionSummary>
        <AccordionDetails className="formContainer">
          <FormControl>
            <FormLabel>Default Path</FormLabel>
            <TextField value={pathDefault} onChange={(e) => setPathDefault(e.target.value)}></TextField>
          </FormControl>
          <FormControl>
            <FormLabel>Run with open Binder</FormLabel>
            <Switch checked={pathRunWith} onChange={(e) => handleSwitch(e, setPathRunWith)} inputProps={{ 'aria-label': 'controlled' }} />
          </FormControl>
          <FormControl>
            <FormLabel>Open with note(or data)</FormLabel>
            <Switch checked={pathOpenWith} disabled={!pathRunWith} onChange={(e) => handleSwitch(e, setPathOpenWith)} inputProps={{ 'aria-label': 'controlled' }} />
          </FormControl>
        </AccordionDetails>
      </Accordion>

      {/** 認証情報 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content">Git</AccordionSummary>
        <AccordionDetails className="formContainer">
          <FormControl>
            <FormLabel>Branch Name</FormLabel>
            <TextField value={gitBranch} onChange={(e) => setGitBranch(e.target.value)}></TextField>
          </FormControl>
          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField value={gitName} onChange={(e) => setGitName(e.target.value)}></TextField>
          </FormControl>
          <FormControl>
            <FormLabel>Mail</FormLabel>
            <TextField value={gitMail} onChange={(e) => setGitMail(e.target.value)}></TextField>
          </FormControl>
          <FormControl>
            <FormLabel>Code</FormLabel>
            <TextField value={gitCode} onChange={(e) => setGitCode(e.target.value)}></TextField>
          </FormControl>

        </AccordionDetails>
      </Accordion>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </FormControl>

    </Grid>
  </>);
}
export default Setting;