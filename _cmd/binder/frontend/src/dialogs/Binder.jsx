import { useEffect, useState, useContext } from "react";

import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormControlLabel, FormLabel, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Switch, TextField,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CircularProgress from '@mui/material/CircularProgress';
import AuthFields from "../components/AuthFields";
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import { GetConfig, EditConfig, RemoteList, AddRemote, EditRemote, DeleteRemote, GetUserInfo, EditUserInfo, CurrentBranch, GetAllowedCDNs, RunGC } from "../../bindings/binder/api/app";
import MarkedScript from "../components/editor/engines/Marked";
import MermaidScript from "../components/editor/engines/Mermaid";
import Scripter from "../components/editor/engines/Scripter";

import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import "../language";
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
  const { showError } = useDialogMessage();
  const {t} = useTranslation();

  const [activeSection, setActiveSection] = useState("basic");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [markedUrl, setMarkedUrl] = useState("");
  const [mermaidUrl, setMermaidUrl] = useState("");
  const [optimizeImage, setOptimizeImage] = useState(true);
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

  // GC
  const [gcConfirmOpen, setGcConfirmOpen] = useState(false);
  const [gcLoading, setGcLoading] = useState(false);

  const getRemoteList = () => {
    RemoteList().then((res) => {
      setRemoteList(res || []);
    }).catch((err) => {
      showError(err);
    });
  };

  useEffect(() => {
    if (!isModal) evt.changeTitle(t("binder.editTitle"));
    GetConfig().then((conf) => {
      setName(conf.name);
      setDetail(conf.detail);
      setMarkedUrl(conf.markedUrl || "");
      setMermaidUrl(conf.mermaidUrl || "");
      setOptimizeImage(conf.optimizeImage !== false);
    }).catch((err) => {
      showError(err);
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
      showError(err);
    });
    CurrentBranch().then((name) => {
      setBranchName(name || "");
    }).catch((err) => {
      showError(err);
    });
    getRemoteList();
  }, []);

  const handleSave = () => {
    const config = { name, detail, markedUrl, mermaidUrl, optimizeImage };
    EditConfig(config).then(() => {
      evt.changeBinderTitle(name);
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      showError(err);
    });
  };

  // --- GC ---
  const formatSize = (bytes) => {
    if (bytes == null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  };

  const handleRunGC = () => {
    setGcConfirmOpen(false);
    setGcLoading(true);
    RunGC().then((result) => {
      const before = formatSize(result.beforeSize);
      const after = formatSize(result.afterSize);
      evt.showSuccessMessage(t("binder.gcComplete", { before, after }));
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setGcLoading(false);
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
      showError(err);
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
      showError(err);
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
      showError(err);
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
      showError(err);
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

            <FormControlLabel
              control={
                <Switch checked={optimizeImage} onChange={(e) => setOptimizeImage(e.target.checked)} size="small" />
              }
              label={t("binder.optimizeImage")}
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', color: 'var(--text-primary)' } }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSave} aria-label="save" sx={{ '& svg': { fill: 'var(--accent-blue)' } }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

            <Box sx={{ borderTop: '1px solid var(--border-subtle)', pt: 2, mt: 1 }}>
              <FormLabel sx={{ mb: 1 }}>{t("binder.gcLabel")}</FormLabel>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={gcLoading ? <CircularProgress size={16} /> : <CleaningServicesIcon fontSize="small" />}
                  onClick={() => setGcConfirmOpen(true)}
                  disabled={gcLoading}
                  sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                >
                  {t("binder.gcButton")}
                </Button>
              </Box>
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

      {/** GC確認ダイアログ */}
      <Dialog
        open={gcConfirmOpen}
        onClose={() => setGcConfirmOpen(false)}
        PaperProps={{ style: { backgroundColor: "var(--bg-button)" } }}
      >
        <DialogTitle style={{ color: "var(--text-secondary)" }}>{t("binder.gcTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            {t("binder.gcConfirmMessage")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGcConfirmOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleRunGC} color="primary">{t("binder.gcRun")}</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default Binder;
