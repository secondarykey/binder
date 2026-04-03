import { useEffect, useState, useContext } from "react";

import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, IconButton, List, ListItemButton, ListItemIcon, ListItemText, TextField,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CircularProgress from '@mui/material/CircularProgress';
import AuthFields from "../components/AuthFields";
import { GetConfig, EditConfig, RemoteList, AddRemote, EditRemote, DeleteRemote, GetUserInfo, EditUserInfo, CurrentBranch, GetAllowedCDNs } from "../../bindings/binder/api/app";
import MarkedScript from "../components/editor/engines/Marked";
import MermaidScript from "../components/editor/engines/Mermaid";
import Scripter from "../components/editor/engines/Scripter";

import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const MENU_ITEMS_KEYS = [
  { key: "basic", labelKey: "setting.basic" },
  { key: "script", labelKey: "binder.script" },
  { key: "git", labelKey: "binder.git" },
];

/**
 * バインダーのメタデータを表示・編集
 */
function Binder({ isModal, ...props }) {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [activeSection, setActiveSection] = useState("basic");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [markedUrl, setMarkedUrl] = useState("");
  const [mermaidUrl, setMermaidUrl] = useState("");
  const [scriptSaving, setScriptSaving] = useState(false);
  const [markedStatus, setMarkedStatus] = useState("");  // "", "ok", "error"
  const [mermaidStatus, setMermaidStatus] = useState(""); // "", "ok", "error"

  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  const [branchName, setBranchName] = useState("");
  const [remoteList, setRemoteList] = useState([]);

  // 認証情報
  const [authType, setAuthType] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authPassphrase, setAuthPassphrase] = useState("");
  const [authSSHKey, setAuthSSHKey] = useState("");

  // リモートダイアログ（追加・編集兼用）
  const [remoteDialog, showRemoteDialog] = useState(false);
  const [remoteDialogMode, setRemoteDialogMode] = useState("add"); // "add" or "edit"
  const [remoteName, setRemoteName] = useState("");
  const [remoteURL, setRemoteURL] = useState("");

  // 削除確認ダイアログ
  const [deleteDialog, showDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");

  const getRemoteList = () => {
    RemoteList().then((res) => {
      setRemoteList(res || []);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  useEffect(() => {
    if (!isModal) evt.changeTitle(t("binder.editTitle"));
    GetConfig().then((conf) => {
      setName(conf.name);
      setDetail(conf.detail);
      setMarkedUrl(conf.markedUrl || "");
      setMermaidUrl(conf.mermaidUrl || "");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    GetUserInfo().then((info) => {
      setGitName(info.name || "");
      setGitMail(info.email || "");
      setAuthType(info.auth_type || "");
      setAuthUsername(info.username || "");
      setAuthPassword(info.password || "");
      setAuthToken(info.token || "");
      setAuthPassphrase(info.passphrase || "");
      if (info.bytes) {
        const decoder = new TextDecoder();
        setAuthSSHKey(decoder.decode(new Uint8Array(info.bytes)));
      } else {
        setAuthSSHKey("");
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    CurrentBranch().then((name) => {
      setBranchName(name || "");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    getRemoteList();
  }, []);

  const handleSave = () => {
    const config = { name, detail, markedUrl, mermaidUrl };
    EditConfig(config).then(() => {
      evt.changeBinderTitle(name);
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleSaveScript = async () => {
    setScriptSaving(true);
    setMarkedStatus("");
    setMermaidStatus("");
    try {
      // ホワイトリストを取得
      let allowedDomains = [];
      try {
        allowedDomains = await GetAllowedCDNs() || [];
      } catch (e) {}

      const config = { name, detail, markedUrl, mermaidUrl };
      await EditConfig(config);

      // marked の検証と差し替え
      if (markedUrl) {
        if (!Scripter.isAllowedUrl(markedUrl, allowedDomains)) {
          setMarkedStatus("error");
        } else {
          const result = await MarkedScript.loadAndValidate(markedUrl);
          setMarkedStatus(result.success ? "ok" : "error");
        }
      } else {
        MarkedScript.reset();
        setMarkedStatus("");
      }

      // mermaid の検証と差し替え
      if (mermaidUrl) {
        if (!Scripter.isAllowedUrl(mermaidUrl, allowedDomains)) {
          setMermaidStatus("error");
        } else {
          const result = await MermaidScript.loadAndValidate(mermaidUrl);
          setMermaidStatus(result.success ? "ok" : "error");
        }
      } else {
        MermaidScript.reset();
        setMermaidStatus("");
      }

      evt.showSuccessMessage(t("binder.updateSuccess"));
    } catch (err) {
      evt.showErrorMessage(err);
    } finally {
      setScriptSaving(false);
    }
  };

  const handleSaveUserInfo = () => {
    EditUserInfo({
      name: gitName, email: gitMail,
      auth_type: authType, username: authUsername, password: authPassword,
      token: authToken, passphrase: authPassphrase, filename: '',
      bytes: Array.from(new TextEncoder().encode(authSSHKey)),
    }).then(() => {
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // リモート追加ダイアログを開く
  const openAddRemoteDialog = () => {
    setRemoteDialogMode("add");
    setRemoteName("origin");
    setRemoteURL("");
    showRemoteDialog(true);
  };

  // リモート編集ダイアログを開く
  const openEditRemoteDialog = (remote) => {
    setRemoteDialogMode("edit");
    setRemoteName(remote.name);
    setRemoteURL(remote.url);
    showRemoteDialog(true);
  };

  const handleRemoteDialogClose = () => showRemoteDialog(false);

  const handleRemoteDialogSubmit = (event) => {
    event.preventDefault();
    const action = remoteDialogMode === "add"
      ? AddRemote(remoteName, remoteURL)
      : EditRemote(remoteName, remoteURL);
    action.then(() => {
      getRemoteList();
      handleRemoteDialogClose();
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // 削除確認ダイアログを開く
  const openDeleteDialog = (name) => {
    setDeleteTarget(name);
    showDeleteDialog(true);
  };

  const handleDeleteDialogClose = () => showDeleteDialog(false);

  const handleDeleteRemote = () => {
    DeleteRemote(deleteTarget).then(() => {
      getRemoteList();
      handleDeleteDialogClose();
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

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
        {MENU_ITEMS_KEYS.map((item) => (
          <ListItemButton
            key={item.key}
            selected={activeSection === item.key}
            onClick={() => setActiveSection(item.key)}
            sx={{
              py: 1,
              px: 1.5,
              '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
              '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
              '&:hover': { backgroundColor: 'var(--bg-elevated)' },
            }}
          >
            <ListItemText
              primary={t(item.labelKey)}
              primaryTypographyProps={{ fontSize: '13px' }}
            />
          </ListItemButton>
        ))}
      </List>

      {/** 右コンテンツ */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {activeSection === "basic" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            <FormControl>
              <FormLabel>{t("common.name")}</FormLabel>
              <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>{t("common.detail")}</FormLabel>
              <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSave} aria-label="save" sx={{ '& svg': { fill: 'var(--accent-blue)' } }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

          </div>
        )}

        {activeSection === "script" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            <FormControl>
              <FormLabel>{t("binder.markedUrl")}</FormLabel>
              <TextField
                size="small"
                value={markedUrl}
                onChange={(e) => { setMarkedUrl(e.target.value); setMarkedStatus(""); }}
                placeholder="https://cdn.jsdelivr.net/npm/marked@14.1.4/lib/marked.esm.js"
                helperText={
                  markedStatus === "ok" ? t("binder.cdnOk") :
                  markedStatus === "error" ? t("binder.cdnLoadError") :
                  t("binder.cdnHint")
                }
                error={markedStatus === "error"}
                color={markedStatus === "ok" ? "success" : undefined}
                focused={markedStatus === "ok"}
              />
            </FormControl>

            <FormControl>
              <FormLabel>{t("binder.mermaidUrl")}</FormLabel>
              <TextField
                size="small"
                value={mermaidUrl}
                onChange={(e) => { setMermaidUrl(e.target.value); setMermaidStatus(""); }}
                placeholder="https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs"
                helperText={
                  mermaidStatus === "ok" ? t("binder.cdnOk") :
                  mermaidStatus === "error" ? t("binder.cdnLoadError") :
                  t("binder.cdnHint")
                }
                error={mermaidStatus === "error"}
                color={mermaidStatus === "ok" ? "success" : undefined}
                focused={mermaidStatus === "ok"}
              />
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 2 }}>
              {scriptSaving && <CircularProgress size={24} />}
              <IconButton onClick={handleSaveScript} disabled={scriptSaving} aria-label="save" sx={{ '& svg': { fill: 'var(--accent-blue)' } }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

          </div>
        )}

        {activeSection === "git" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            {/** ブランチ */}
            <FormControl>
              <FormLabel>{t("binder.currentBranch")}</FormLabel>
              <TextField size="small" value={branchName} InputProps={{ readOnly: true }} />
            </FormControl>

            {/** ユーザ情報 */}
            <FormControl>
              <FormLabel>{t("binder.userName")}</FormLabel>
              <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>{t("binder.userEmail")}</FormLabel>
              <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
            </FormControl>

            {/** 認証情報 */}
            <AuthFields
              authType={authType} onAuthTypeChange={setAuthType}
              username={authUsername} onUsernameChange={setAuthUsername}
              password={authPassword} onPasswordChange={setAuthPassword}
              token={authToken} onTokenChange={setAuthToken}
              passphrase={authPassphrase} onPassphraseChange={setAuthPassphrase}
              sshKey={authSSHKey} onSSHKeyChange={setAuthSSHKey}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSaveUserInfo} aria-label="save" sx={{ '& svg': { fill: 'var(--accent-blue)' } }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

            {/** リモート一覧 */}
            <FormControl>
              <FormLabel>
                {t("binder.settingRemote")}
                <IconButton size="small" onClick={openAddRemoteDialog}><AddIcon fontSize="small" /></IconButton>
              </FormLabel>
              <List dense disablePadding>
                {remoteList.map((r) => (
                  <ListItemButton
                    key={r.name}
                    onClick={() => openEditRemoteDialog(r)}
                    sx={{
                      py: 0.5,
                      '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                    }}
                  >
                    <ListItemText
                      primary={r.name}
                      secondary={r.url}
                      primaryTypographyProps={{ fontSize: '13px' }}
                      secondaryTypographyProps={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                    />
                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(r.name); }}
                        sx={{ '& svg': { fill: 'var(--accent-red)' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemIcon>
                  </ListItemButton>
                ))}
              </List>
            </FormControl>

          </div>
        )}

      </Box>

      {/** リモート追加・編集ダイアログ */}
      <Dialog
        open={remoteDialog}
        onClose={handleRemoteDialogClose}
        PaperProps={{
          component: 'form',
          onSubmit: handleRemoteDialogSubmit,
          style: { backgroundColor: "var(--bg-button)" },
        }}
      >
        <DialogTitle style={{ color: "var(--text-secondary)" }}>
          {remoteDialogMode === "add" ? t("binder.settingRemote") : t("binder.editRemote")}
        </DialogTitle>
        <DialogContent>
          <TextField
            required margin="dense" label={t("binder.remoteName")}
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            fullWidth variant="standard"
            disabled={remoteDialogMode === "edit"}
          />
          <TextField
            autoFocus required margin="dense" label={t("binder.remoteUrl")}
            value={remoteURL}
            onChange={(e) => setRemoteURL(e.target.value)}
            fullWidth variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRemoteDialogClose}>{t("common.cancel")}</Button>
          <Button type="submit">{t("common.set")}</Button>
        </DialogActions>
      </Dialog>

      {/** リモート削除確認ダイアログ */}
      <Dialog
        open={deleteDialog}
        onClose={handleDeleteDialogClose}
        PaperProps={{ style: { backgroundColor: "var(--bg-button)" } }}
      >
        <DialogTitle style={{ color: "var(--text-secondary)" }}>{t("binder.deleteRemoteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            {t("binder.deleteRemoteConfirm", { name: deleteTarget })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose}>{t("common.cancel")}</Button>
          <Button onClick={handleDeleteRemote} color="error">{t("common.delete")}</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default Binder;
