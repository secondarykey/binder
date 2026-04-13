import { useState, useEffect, useContext } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContentText, DialogTitle,
  IconButton, List, ListItem, ListItemText, TextField, Typography, Chip, Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

import ModalWrapper from './components/ModalWrapper';
import { ListBranches, CurrentBranch, SwitchBranch, CreateBranch, RenameBranch, GetModifiedIds } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import '../language';
import { useTranslation } from 'react-i18next';

function BranchModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [renamingBranch, setRenamingBranch] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasUncommitted, setHasUncommitted] = useState(false);
  const [confirmSwitchName, setConfirmSwitchName] = useState(null);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    reload();
    setNewBranchName('');
    setRenamingBranch(null);
    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => showError(err));
  }, [open]);

  const reload = () => {
    ListBranches().then(setBranches).catch((err) => showError(err));
    CurrentBranch().then(setCurrentBranch).catch((err) => showError(err));
  };

  const doSwitch = (name) => {
    setConfirmSwitchName(null);
    setLoading(true);
    SwitchBranch(name).then((result) => {
      if (result.address) evt.changeAddress(result.address);
      if (result.status === 'success') {
        evt.refreshTree();
        evt.showSuccessMessage(t('branch.switchSuccess', { name }));
        onClose();
      } else if (result.status === 'reload_error') {
        showError(t('branch.reloadError'));
        onClose();
      } else if (result.status === 'error') {
        showError(result.message);
        reload();
      }
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const doCreate = () => {
    setConfirmCreateOpen(false);
    if (!newBranchName.trim()) return;
    setLoading(true);
    CreateBranch(newBranchName.trim()).then((result) => {
      if (result.address) evt.changeAddress(result.address);
      if (result.status === 'success') {
        evt.refreshTree();
        evt.showSuccessMessage(t('branch.createSuccess', { name: newBranchName.trim() }));
        onClose();
      } else if (result.status === 'reload_error') {
        showError(t('branch.reloadError'));
        onClose();
      } else if (result.status === 'error') {
        showError(result.message);
        reload();
      }
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleRename = (oldName) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingBranch(null);
      return;
    }
    setLoading(true);
    RenameBranch(oldName, renameValue.trim()).then(() => {
      evt.showSuccessMessage(t('branch.renameSuccess', { old: oldName, new: renameValue.trim() }));
      setRenamingBranch(null);
      reload();
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const startRename = (name) => {
    setRenamingBranch(name);
    setRenameValue(name);
  };

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      title={t("branch.title")}
      width="480px"
      height="auto"
      maxHeight="80vh"
    >
      <Box sx={{ p: 2, overflowY: 'auto' }}>

        {hasUncommitted && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '13px' }}>
            {t('branch.uncommittedError')}
          </Alert>
        )}

        {/** ブランチ一覧 */}
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--text-muted)' }}>
          {t("branch.list")}
        </Typography>

        <List dense sx={{ mb: 2 }}>
          {branches.map((name) => (
            <ListItem
              key={name}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                backgroundColor: name === currentBranch ? 'var(--bg-elevated)' : 'transparent',
              }}
              secondaryAction={
                renamingBranch === name ? (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleRename(name)} disabled={loading}>
                      <CheckIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => setRenamingBranch(null)}>
                      <CloseIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {name === currentBranch && (
                      <IconButton size="small" onClick={() => startRename(name)} disabled={loading || hasUncommitted}
                        title={t("branch.rename")}>
                        <EditIcon sx={{ fontSize: '16px' }} />
                      </IconButton>
                    )}
                    {name !== currentBranch && (
                      <Button size="small" variant="outlined" onClick={() => setConfirmSwitchName(name)}
                        disabled={loading || hasUncommitted} sx={{ minWidth: 'auto', fontSize: '12px', py: 0 }}>
                        {t("branch.switch")}
                      </Button>
                    )}
                  </Box>
                )
              }
            >
              {renamingBranch === name ? (
                <TextField
                  size="small"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(name);
                    if (e.key === 'Escape') setRenamingBranch(null);
                  }}
                  autoFocus
                  sx={{ mr: 1, '& .MuiInputBase-input': { py: 0.5, fontSize: '14px' } }}
                />
              ) : (
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {name === currentBranch && <CheckIcon sx={{ fontSize: '14px', color: 'var(--accent-primary)' }} />}
                      <span style={{ fontWeight: name === currentBranch ? 'bold' : 'normal' }}>{name}</span>
                    </Box>
                  }
                />
              )}
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        {/** 新規作成 */}
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--text-muted)' }}>
          {t("branch.create")}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder={t("branch.branchName")}
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setConfirmCreateOpen(true); }}
            disabled={loading}
            sx={{ flex: 1, '& .MuiInputBase-input': { py: 0.5, fontSize: '14px' } }}
          />
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setConfirmCreateOpen(true)}
            disabled={loading || hasUncommitted || !newBranchName.trim()}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t("branch.create")}
          </Button>
        </Box>

      </Box>

      {/** ブランチ切替確認ダイアログ */}
      <Dialog
        open={!!confirmSwitchName}
        onClose={() => setConfirmSwitchName(null)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' } }}
      >
        <DialogTitle>{t("branch.switch")}</DialogTitle>
        <DialogContentText style={{ padding: '0 24px 8px', color: 'var(--text-secondary)' }}>
          {t('branch.confirmSwitch')}
        </DialogContentText>
        <DialogActions>
          <Button onClick={() => setConfirmSwitchName(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => doSwitch(confirmSwitchName)}>{t('branch.switch')}</Button>
        </DialogActions>
      </Dialog>

      {/** ブランチ作成確認ダイアログ */}
      <Dialog
        open={confirmCreateOpen}
        onClose={() => setConfirmCreateOpen(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' } }}
      >
        <DialogTitle>{t("branch.create")}</DialogTitle>
        <DialogContentText style={{ padding: '0 24px 8px', color: 'var(--text-secondary)' }}>
          {t('branch.confirmCreate', { name: newBranchName.trim(), from: currentBranch })}
        </DialogContentText>
        <DialogActions>
          <Button onClick={() => setConfirmCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={doCreate}>{t('branch.create')}</Button>
        </DialogActions>
      </Dialog>

    </ModalWrapper>
  );
}

export default BranchModal;
