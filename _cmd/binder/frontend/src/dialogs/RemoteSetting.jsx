import { useState, useEffect } from 'react';

import {
  Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, List, ListItemButton, ListItemIcon, ListItemText, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

import { RemoteList, AddRemote, EditRemote, DeleteRemote } from '../../bindings/binder/api/app';

import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * リモート設定ダイアログ
 * リモートの一覧・追加・編集・削除を行う。マージ画面から開く。
 * @param {{ open: boolean, onClose: () => void, onChanged?: () => void }} props
 *   onChanged はリモートが追加・編集・削除された時に呼ばれる（呼び出し側の一覧再取得用）
 */
function RemoteSetting({ open, onClose, onChanged = () => {} }) {

  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [remoteList, setRemoteList] = useState([]);

  // 追加・編集兼用の入力ダイアログ
  const [editDialog, showEditDialog] = useState(false);
  const [editMode, setEditMode] = useState('add'); // "add" or "edit"
  const [remoteName, setRemoteName] = useState('');
  const [remoteURL, setRemoteURL] = useState('');

  // 削除確認ダイアログ
  const [deleteDialog, showDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState('');

  useEffect(() => {
    if (open) getRemoteList();
  }, [open]);

  const getRemoteList = () => {
    RemoteList().then((res) => {
      setRemoteList(res || []);
    }).catch((err) => {
      showError(err);
    });
  };

  const openAddDialog = () => {
    setEditMode('add');
    setRemoteName('origin');
    setRemoteURL('');
    showEditDialog(true);
  };

  const openEditDialog = (remote) => {
    setEditMode('edit');
    setRemoteName(remote.name);
    setRemoteURL(remote.url);
    showEditDialog(true);
  };

  const handleEditDialogClose = () => showEditDialog(false);

  const handleEditDialogSubmit = (event) => {
    event.preventDefault();
    const action = editMode === 'add'
      ? AddRemote(remoteName, remoteURL)
      : EditRemote(remoteName, remoteURL);
    action.then(() => {
      getRemoteList();
      onChanged();
      handleEditDialogClose();
    }).catch((err) => {
      showError(err);
    });
  };

  const openDeleteDialog = (name) => {
    setDeleteTarget(name);
    showDeleteDialog(true);
  };

  const handleDeleteDialogClose = () => showDeleteDialog(false);

  const handleDeleteRemote = () => {
    DeleteRemote(deleteTarget).then(() => {
      getRemoteList();
      onChanged();
      handleDeleteDialogClose();
    }).catch((err) => {
      showError(err);
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ style: { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-secondary)' }}>
          <Box component="span" sx={{ flex: 1 }}>{t('binder.settingRemote')}</Box>
          <IconButton size="small" onClick={openAddDialog} aria-label="add">
            <AddIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mb: 1 }}>
            {t('binder.remoteHint')}
          </Typography>
          <List dense disablePadding>
            {remoteList.map((r) => (
              <ListItemButton
                key={r.name}
                onClick={() => openEditDialog(r)}
                sx={{ py: 0.5, '&:hover': { backgroundColor: 'var(--bg-elevated)' } }}
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
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t('common.close')} icon={<CloseIcon />} onClick={onClose} />
        </DialogActions>
      </Dialog>

      {/** リモート追加・編集ダイアログ */}
      <Dialog
        open={editDialog}
        onClose={handleEditDialogClose}
        PaperProps={{
          component: 'form',
          onSubmit: handleEditDialogSubmit,
          style: { backgroundColor: 'var(--bg-button)' },
        }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>
          {editMode === 'add' ? t('binder.settingRemote') : t('binder.editRemote')}
        </DialogTitle>
        <DialogContent>
          <TextField
            required margin="dense" label={t('binder.remoteName')}
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            fullWidth variant="standard"
            disabled={editMode === 'edit'}
          />
          <TextField
            autoFocus required margin="dense" label={t('binder.remoteUrl')}
            value={remoteURL}
            onChange={(e) => setRemoteURL(e.target.value)}
            fullWidth variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t('common.cancel')} icon={<CloseIcon />} onClick={handleEditDialogClose} />
          <ActionButton variant="save" label={t('common.set')} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} type="submit" />
        </DialogActions>
      </Dialog>

      {/** リモート削除確認ダイアログ */}
      <Dialog
        open={deleteDialog}
        onClose={handleDeleteDialogClose}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)' } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t('binder.deleteRemoteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {t('binder.deleteRemoteConfirm', { name: deleteTarget })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t('common.cancel')} icon={<CloseIcon />} onClick={handleDeleteDialogClose} />
          <ActionButton variant="delete" label={t('common.delete')} icon={<DeleteIcon />} onClick={handleDeleteRemote} />
        </DialogActions>
      </Dialog>
    </>
  );
}

export default RemoteSetting;
