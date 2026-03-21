import { useEffect, useState, useContext } from "react";

import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, IconButton, List, ListItemButton, ListItemIcon, ListItemText, TextField,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { GetConfig, EditConfig, RemoteList, AddRemote, EditRemote, DeleteRemote, GetUserInfo, EditUserInfo } from "../../bindings/binder/api/app";

import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const MENU_ITEMS_KEYS = [
  { key: "basic", labelKey: "setting.basic" },
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

  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  const [remoteList, setRemoteList] = useState([]);

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
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    GetUserInfo().then((info) => {
      setGitName(info.name || "");
      setGitMail(info.email || "");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    getRemoteList();
  }, []);

  const handleSave = () => {
    const config = { name, detail };
    EditConfig(config).then(() => {
      evt.changeBinderTitle(name);
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleSaveUserInfo = () => {
    EditUserInfo({ name: gitName, email: gitMail }).then(() => {
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // リモート追加ダイアログを開く
  const openAddRemoteDialog = () => {
    setRemoteDialogMode("add");
    setRemoteName("");
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
              <IconButton onClick={handleSave} aria-label="save" sx={{ color: 'var(--accent-blue)' }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

          </div>
        )}

        {activeSection === "git" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            {/** ユーザ情報 */}
            <FormControl>
              <FormLabel>{t("binder.userName")}</FormLabel>
              <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>{t("binder.userEmail")}</FormLabel>
              <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <IconButton onClick={handleSaveUserInfo} aria-label="save" sx={{ color: 'var(--accent-blue)' }}>
                <SaveIcon fontSize="large" />
              </IconButton>
            </Box>

            {/** リモート一覧 */}
            <FormControl>
              <FormLabel>
                {t("binder.settingRemote")}
                <Button onClick={openAddRemoteDialog}>{t("common.add")}</Button>
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
                        sx={{ color: 'var(--text-secondary)' }}
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
