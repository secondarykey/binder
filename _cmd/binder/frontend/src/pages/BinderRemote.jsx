import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router";

import { CreateRemoteBinder, GetGit } from "../../bindings/binder/api/app";
import { SelectDirectory } from "../../bindings/main/window";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Button, Checkbox, FormControl, FormControlLabel, FormLabel,
  Grid, InputAdornment, MenuItem, Select, TextField, Typography,
} from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Event, { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const AUTH_TYPES = [
  { value: 'basic', labelKey: 'push.authBasic' },
  { value: 'token', labelKey: 'push.authToken' },
  { value: 'ssh_file', labelKey: 'push.authSSHFile' },
  { value: 'ssh_agent', labelKey: 'push.authSSHAgent' },
];

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
          <FormControl size="small">
            <Select
              value={authType}
              onChange={(e) => setAuthType(e.target.value)}
              size="small"
            >
              <MenuItem value="">&nbsp;</MenuItem>
              {AUTH_TYPES.map((at) => (
                <MenuItem key={at.value} value={at.value}>{t(at.labelKey)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Basic認証フィールド */}
          {authType === 'basic' && (
            <>
              <FormControl size="small">
                <FormLabel>{t('push.username')}</FormLabel>
                <TextField size="small" value={username} onChange={(e) => setUsername(e.target.value)} />
              </FormControl>
              <FormControl size="small">
                <FormLabel>{t('push.password')}</FormLabel>
                <TextField size="small" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormControl>
            </>
          )}

          {/* トークン認証フィールド */}
          {authType === 'token' && (
            <FormControl size="small">
              <FormLabel>{t('push.token')}</FormLabel>
              <TextField size="small" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            </FormControl>
          )}

          {/* SSH鍵ファイルフィールド */}
          {authType === 'ssh_file' && (
            <>
              <FormControl size="small">
                <FormLabel>{t('push.filename')}</FormLabel>
                <TextField size="small" value={filename} onChange={(e) => setFilename(e.target.value)} />
              </FormControl>
              <FormControl size="small">
                <FormLabel>{t('push.passphrase')}</FormLabel>
                <TextField size="small" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
              </FormControl>
            </>
          )}

          {/* SSHエージェント: 追加入力なし */}

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
