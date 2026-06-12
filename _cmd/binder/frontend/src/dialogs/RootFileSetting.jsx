import { useState, useEffect, useContext } from "react";

import {
  Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

import { ListRootFiles, ReadRootFile, SaveRootFile, RemoveRootFile, RenameRootFile } from "../../bindings/binder/api/app";
import Marked from "../components/editor/engines/Marked";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-]*$/;
const RESERVED_NAMES = [
  "binder.json", ".gitignore", "user_data.enc",
  "notes", "diagrams", "assets", "layers", "templates", "plugins", "db", "docs",
];
const MARKDOWN_EXT = /\.(md|markdown)$/i;

/**
 * バインダールートのユーザーファイル（README.md 等）管理
 * 変更はコミットされず、未記録一覧から記録する。
 */
function RootFileSetting() {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [files, setFiles] = useState([]);

  // 追加ダイアログ
  const [addDialog, setAddDialog] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNameError, setAddNameError] = useState("");

  // 編集ダイアログ
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMode, setEditMode] = useState("edit"); // "edit" or "preview"
  const [previewHTML, setPreviewHTML] = useState("");

  // リネームダイアログ
  const [renameDialog, setRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [renameName, setRenameName] = useState("");
  const [renameNameError, setRenameNameError] = useState("");

  // 削除確認ダイアログ
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");

  const loadFiles = () => {
    ListRootFiles().then((list) => {
      setFiles(list || []);
    }).catch((err) => showError(err));
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const validateName = (name, excludeName = null) => {
    if (!name.trim()) return t("rootFile.nameRequired");
    if (!NAME_PATTERN.test(name)) return t("rootFile.invalidName");
    if (RESERVED_NAMES.includes(name.toLowerCase())) return t("rootFile.invalidName");
    const exists = files.some((f) => f.name === name && f.name !== excludeName);
    if (exists) return t("rootFile.duplicateName");
    return "";
  };

  // --- 追加 ---
  const handleOpenAddDialog = () => {
    setAddName("");
    setAddNameError("");
    setAddDialog(true);
  };

  const handleAddConfirm = () => {
    const err = validateName(addName);
    if (err) { setAddNameError(err); return; }
    SaveRootFile(addName, "").then(() => {
      evt.showSuccessMessage(t("rootFile.addSuccess"));
      setAddDialog(false);
      loadFiles();
      openEditDialog(addName);
    }).catch((err) => showError(err));
  };

  // --- 編集 ---
  const openEditDialog = (name) => {
    ReadRootFile(name).then((content) => {
      setEditTarget(name);
      setEditContent(content);
      setEditMode("edit");
      setPreviewHTML("");
      setEditDialog(true);
    }).catch((err) => showError(err));
  };

  const handleEditModeChange = (e, mode) => {
    if (mode === null) return;
    setEditMode(mode);
    if (mode === "preview") {
      Marked.parse(editContent).then((html) => {
        setPreviewHTML(html);
      }).catch(() => {
        setPreviewHTML("");
      });
    }
  };

  const handleEditSave = () => {
    SaveRootFile(editTarget, editContent).then(() => {
      evt.showSuccessMessage(t("rootFile.saveSuccess"));
      setEditDialog(false);
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
    RenameRootFile(renameTarget, renameName).then(() => {
      evt.showSuccessMessage(t("rootFile.renameSuccess"));
      setRenameDialog(false);
      loadFiles();
    }).catch((err) => showError(err));
  };

  // --- 削除 ---
  const handleOpenDeleteDialog = (name) => {
    setDeleteTarget(name);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    RemoveRootFile(deleteTarget).then(() => {
      evt.showSuccessMessage(t("rootFile.removeSuccess"));
      setDeleteDialog(false);
      loadFiles();
    }).catch((err) => showError(err));
  };

  const isMarkdown = MARKDOWN_EXT.test(editTarget);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '20px 24px', flex: 1 }}>

        {/** 説明 + 追加ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <Typography variant="caption" sx={{ flex: 1, color: 'var(--text-muted)', textAlign: 'left' }}>
            {t("rootFile.hint")}
          </Typography>
          <ActionButton variant="save" icon={<AddIcon />} label={t("common.add")} onClick={handleOpenAddDialog} size="small" />
        </Box>

        {/** ファイル一覧 */}
        <FormControl>
          {files.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 1, fontSize: '13px', textAlign: 'left' }}>
              {t("rootFile.empty")}
            </Typography>
          ) : (
            <List dense disablePadding>
              {files.map((f) => (
                <ListItemButton
                  key={f.name}
                  onClick={() => openEditDialog(f.name)}
                  sx={{
                    py: 0.5,
                    textAlign: 'left',
                    '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                  }}
                >
                  <ListItemText
                    primary={f.name}
                    primaryTypographyProps={{ fontSize: '13px', textAlign: 'left' }}
                  />
                  <ListItemIcon sx={{ minWidth: 'auto', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      title={t("common.edit")}
                      onClick={(e) => { e.stopPropagation(); openEditDialog(f.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.rename")}
                      onClick={(e) => { e.stopPropagation(); handleOpenRenameDialog(f.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <DriveFileRenameOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.delete")}
                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(f.name); }}
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

      </Box>

      {/** 追加ダイアログ */}
      <Dialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("rootFile.add")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("rootFile.nameLabel")}
            placeholder={t("rootFile.namePlaceholder")}
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

      {/** 編集ダイアログ */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', height: '80vh' } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {editTarget}
          {isMarkdown && (
            <ToggleButtonGroup
              value={editMode}
              exclusive
              size="small"
              onChange={handleEditModeChange}
            >
              <ToggleButton value="edit" sx={{ fontSize: '11px', px: 1.5, color: 'var(--text-muted)', '&.Mui-selected': { color: 'var(--selected-text)', backgroundColor: 'var(--selected-menu)' } }}>
                {t("common.edit")}
              </ToggleButton>
              <ToggleButton value="preview" sx={{ fontSize: '11px', px: 1.5, color: 'var(--text-muted)', '&.Mui-selected': { color: 'var(--selected-text)', backgroundColor: 'var(--selected-menu)' } }}>
                {t("rootFile.preview")}
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column' }}>
          {editMode === "edit" ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                resize: 'none',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-input)',
                borderRadius: 4,
                padding: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <Box
              sx={{
                flex: 1, overflowY: 'auto',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-input)',
                borderRadius: 1, p: 2, textAlign: 'left',
                color: 'var(--text-primary)', fontSize: '14px',
                '& a': { color: 'var(--selected-text)' },
                '& pre': { backgroundColor: 'var(--bg-elevated)', padding: 1, overflowX: 'auto' },
                '& code': { backgroundColor: 'var(--bg-elevated)' },
                '& table': { borderCollapse: 'collapse' },
                '& th, & td': { border: '1px solid var(--border-primary)', padding: '4px 8px' },
                '& blockquote': { borderLeft: '3px solid var(--border-strong)', margin: 0, paddingLeft: 2, color: 'var(--text-secondary)' },
              }}
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setEditDialog(false)} />
          <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleEditSave} />
        </DialogActions>
      </Dialog>

      {/** リネームダイアログ */}
      <Dialog
        open={renameDialog}
        onClose={() => setRenameDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("rootFile.renameTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("rootFile.nameLabel")}
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
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("rootFile.deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {t("rootFile.deleteConfirm", { name: deleteTarget })}
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

export default RootFileSetting;
