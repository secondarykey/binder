import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router";

import { CreateRemoteBinder, GetGit } from "../../bindings/binder/api/app";
import { SelectDirectory } from "../../bindings/main/window";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Button, Checkbox, FormControl, FormControlLabel, FormLabel,
  Grid, InputAdornment, TextField, Typography,
} from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import AuthFields from "../components/AuthFields";
import Event, { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * Binderリモート作成
 * @param {*} props
 * @returns
 */
function BinderRemote(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const { t } = useTranslation();

  const [remote, setRemote] = useState("");
  const [dir, setDir] = useState("");
  const [branch, setBranch] = useState("");
  const [workBranch, setWorkBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  // 認証
  const [authType, setAuthType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [filename, setFilename] = useState('');
  const [save, setSave] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(false);

  useEffect(() => {
    evt.changeTitle("Remote Import");
    GetGit().then((git) => {
      setWorkBranch(git.workBranch || "");
      setGitName(git.name || "");
      setGitMail(git.mail || "");
    });
  }, [])

  //保存
  const handleSave = () => {

    if (remote == "") {
      evt.showWarningMessage("input remote URL");
      return;
    }

    if (dir == "") {
      evt.showWarningMessage("choose directory");
      return;
    }

    const info = {
      name: gitName,
      email: gitMail,
      auth_type: authType,
      username,
      password,
      token,
      passphrase,
      filename,
      bytes: null,
    };

    CreateRemoteBinder(remote, dir, branch, workBranch, info, save).then(() => {

      //TODO アドレス変更通知

      //開く
      nav("/binder/");

    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  const selectDir = () => {
    SelectDirectory(true).then((f) => {
      if (f != "") {
        setDir(f);
      }
    }).catch((err) => {
      evt.showErrorMessage(err)
    });
  }

  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Repository(URL)</FormLabel>
        <TextField value={remote} onChange={(e) => setRemote(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Binder Directory</FormLabel>
        <TextField value={dir} onClick={selectDir}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FolderIcon />
              </InputAdornment>
            )
          }}>
        </TextField>
      </FormControl>

      {/** クローン対象ブランチ */}
      <FormControl>
        <FormLabel>{t("binderRemote.remoteBranch")}</FormLabel>
        <TextField size="small" value={branch} onChange={(e) => setBranch(e.target.value)} />
      </FormControl>

      {/** 作業ブランチ */}
      <FormControl>
        <FormLabel>{t("setting.workBranch")}</FormLabel>
        <TextField size="small" value={workBranch} onChange={(e) => setWorkBranch(e.target.value)} />
      </FormControl>

      {/** 名前 */}
      <FormControl>
        <FormLabel>{t("setting.gitName")}</FormLabel>
        <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
      </FormControl>

      {/** メールアドレス */}
      <FormControl>
        <FormLabel>{t("setting.gitMail")}</FormLabel>
        <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
      </FormControl>

      {/** 認証情報（折りたたみ） */}
      <Accordion
        expanded={authExpanded}
        onChange={(_, expanded) => setAuthExpanded(expanded)}
        disableGutters
        sx={{
          backgroundColor: 'transparent',
          boxShadow: 'none',
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--text-secondary)' }} />}>
          <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {t('push.authType')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
          <AuthFields
            authType={authType} onAuthTypeChange={setAuthType}
            username={username} onUsernameChange={setUsername}
            password={password} onPasswordChange={setPassword}
            token={token} onTokenChange={setToken}
            passphrase={passphrase} onPassphraseChange={setPassphrase}
            filename={filename} onFilenameChange={setFilename}
          />

          {/* 保存チェックボックス */}
          <FormControlLabel
            control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} size="small" />}
            label={t('push.saveCredentials')}
            sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
          />
        </AccordionDetails>
      </Accordion>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          <> Create </>
        </Button>
      </FormControl>
    </Grid>
  </>);
}
export default BinderRemote;
