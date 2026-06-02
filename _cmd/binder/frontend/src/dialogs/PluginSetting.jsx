import { useState, useEffect, useContext } from "react";

import {
  Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, MenuItem, Select, TextField, Typography,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

import { ListPlugins, SavePlugin, RemovePlugin, RenamePlugin } from "../../bindings/binder/api/app";
import { SelectJSFile } from "../../bindings/main/window";
import Marked from "../components/editor/engines/Marked";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

const ENGINES = [
  { value: "marked", labelKey: "plugin.engineMarkdown" },
];

const NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function PluginSetting() {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [engine, setEngine] = useState("marked");
  const [plugins, setPlugins] = useState([]);
  const [selectedName, setSelectedName] = useState(null);

  // 追加ダイアログ
  const [addDialog, setAddDialog] = useState(false);
  const [addName, setAddName] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addNameError, setAddNameError] = useState("");

  // リネームダイアログ
  const [renameDialog, setRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [renameName, setRenameName] = useState("");
  const [renameNameError, setRenameNameError] = useState("");

  // 削除確認ダイアログ
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");

  const loadPlugins = () => {
    ListPlugins(engine).then((list) => {
      setPlugins(list || []);
    }).catch((err) => showError(err));
  };

  useEffect(() => {
    loadPlugins();
    setSelectedName(null);
  }, [engine]);

  // --- 追加 ---
  const handleOpenAddDialog = () => {
    SelectJSFile().then((info) => {
      if (!info) return;
      setAddName(info.name);
      setAddContent(info.content);
      setAddNameError("");
      setAddDialog(true);
    }).catch((err) => showError(err));
  };

  const validateName = (name, excludeName = null) => {
    if (!name.trim()) return t("plugin.nameRequired");
    if (!NAME_PATTERN.test(name)) return t("plugin.invalidName");
    const exists = plugins.some((p) => p.name === name && p.name !== excludeName);
    if (exists) return t("plugin.duplicateName");
    return "";
  };

  const handleAddConfirm = () => {
    const err = validateName(addName);
    if (err) { setAddNameError(err); return; }
    SavePlugin(engine, addName, addContent).then(() => {
      evt.showSuccessMessage(t("plugin.addSuccess"));
      setAddDialog(false);
      loadPlugins();
      Marked.reset();
    }).catch((err) => showError(err));
  };

  // --- 更新（ファイル再インポート）---
  const handleUpdate = (name) => {
    SelectJSFile().then((info) => {
      if (!info) return;
      SavePlugin(engine, name, info.content).then(() => {
        evt.showSuccessMessage(t("plugin.updateSuccess"));
        loadPlugins();
        Marked.reset();
      }).catch((err) => showError(err));
    }).catch((err) => showError(err));
  };

  // --- リネーム ---
  const handleOpenRenameDialog = (name) => {
    setRenameTarget(name);
    setRenameName(name);
    setRenameNameError("");
    setRenameDialog(true);
  };

  const handleRenameConfirm = () => {
    const err = validateName(renameName, renameTarget);
    if (err) { setRenameNameError(err); return; }
    if (renameName === renameTarget) { setRenameDialog(false); return; }
    RenamePlugin(engine, renameTarget, renameName).then(() => {
      evt.showSuccessMessage(t("plugin.renameSuccess"));
      setRenameDialog(false);
      loadPlugins();
      Marked.reset();
    }).catch((err) => showError(err));
  };

  // --- 削除 ---
  const handleOpenDeleteDialog = (name) => {
    setDeleteTarget(name);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    RemovePlugin(engine, deleteTarget).then(() => {
      evt.showSuccessMessage(t("plugin.removeSuccess"));
      setDeleteDialog(false);
      if (selectedName === deleteTarget) setSelectedName(null);
      loadPlugins();
      Marked.reset();
    }).catch((err) => showError(err));
  };

  const inputSx = {
    fontSize: '13px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-dropdown)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-muted)' },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="formGrid" style={{ margin: '20px 24px', flex: 1 }}>

        {/** タイプ選択 + 追加ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>{t("plugin.type")}</FormLabel>
            <Select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              size="small"
              sx={inputSx}
              MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
            >
              {ENGINES.map((e) => (
                <MenuItem key={e.value} value={e.value} sx={{ fontSize: '13px' }}>
                  {t(e.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ActionButton variant="save" icon={<AddIcon />} label={t("common.add")} onClick={handleOpenAddDialog} size="small" />
        </Box>

        {/** プラグイン一覧 */}
        <FormControl>
          {plugins.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 1, fontSize: '13px', textAlign: 'left' }}>
              {t("plugin.empty")}
            </Typography>
          ) : (
            <List dense disablePadding>
              {plugins.map((p) => (
                <ListItemButton
                  key={p.name}
                  selected={selectedName === p.name}
                  onClick={() => setSelectedName(p.name)}
                  sx={{
                    py: 0.5,
                    textAlign: 'left',
                    '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
                    '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
                    '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                  }}
                >
                  <ListItemText
                    primary={p.name}
                    primaryTypographyProps={{ fontSize: '13px', textAlign: 'left' }}
                  />
                  <ListItemIcon sx={{ minWidth: 'auto', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      title={t("plugin.update")}
                      onClick={(e) => { e.stopPropagation(); handleUpdate(p.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <UploadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.rename")}
                      onClick={(e) => { e.stopPropagation(); handleOpenRenameDialog(p.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <DriveFileRenameOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.delete")}
                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(p.name); }}
                      sx={{ '& svg': { fill: 'var(--accent-red)' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemIcon>
                </ListItemButton>
              ))}
            </List>
          )}
        </FormControl>

      </div>

      {/** 追加ダイアログ */}
      <Dialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.add")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("plugin.nameLabel")}
            placeholder={t("plugin.namePlaceholder")}
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddNameError(""); }}
            error={!!addNameError}
            helperText={addNameError}
            size="small"
            fullWidth
            margin="dense"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddConfirm(); } }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setAddDialog(false)} />
          <ActionButton variant="save" label={t("common.add")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleAddConfirm} />
        </DialogActions>
      </Dialog>

      {/** リネームダイアログ */}
      <Dialog
        open={renameDialog}
        onClose={() => setRenameDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.renameTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("plugin.nameLabel")}
            value={renameName}
            onChange={(e) => { setRenameName(e.target.value); setRenameNameError(""); }}
            error={!!renameNameError}
            helperText={renameNameError}
            size="small"
            fullWidth
            margin="dense"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameConfirm(); } }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setRenameDialog(false)} />
          <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleRenameConfirm} />
        </DialogActions>
      </Dialog>

      {/** 削除確認ダイアログ */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)' } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {t("plugin.deleteConfirm", { name: deleteTarget })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setDeleteDialog(false)} />
          <ActionButton variant="delete" label={t("common.delete")} icon={<DeleteIcon />} onClick={handleDeleteConfirm} />
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default PluginSetting;
