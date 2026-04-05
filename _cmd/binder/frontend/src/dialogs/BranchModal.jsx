import { useState, useEffect, useContext } from 'react';
import {
  Alert, Box, Button, IconButton, List, ListItem, ListItemText, TextField, Typography, Chip, Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

import ModalWrapper from './components/ModalWrapper';
import { ListBranches, CurrentBranch, SwitchBranch, CreateBranch, RenameBranch, GetModifiedIds } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

function BranchModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [renamingBranch, setRenamingBranch] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasUncommitted, setHasUncommitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    reload();
    setNewBranchName('');
    setRenamingBranch(null);
    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => evt.showErrorMessage(err));
  }, [open]);

  const reload = () => {
    ListBranches().then(setBranches).catch((err) => evt.showErrorMessage(err));
    CurrentBranch().then(setCurrentBranch).catch((err) => evt.showErrorMessage(err));
  };

  const handleSwitch = (name) => {
    setLoading(true);
    SwitchBranch(name).then((result) => {
      if (result.address) evt.changeAddress(result.address);
      if (result.status === 'success') {
        evt.refreshTree();
        evt.showSuccessMessage(t('branch.switchSuccess', { name }));
        onClose();
      } else if (result.status === 'reload_error') {
        evt.showErrorMessage(t('branch.reloadError'));
        onClose();
      } else if (result.status === 'error') {
        evt.showErrorMessage(result.message);
        reload();
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleCreate = () => {
    if (!newBranchName.trim()) return;
    setLoading(true);
    CreateBranch(newBranchName.trim()).then((result) => {
      if (result.address) evt.changeAddress(result.address);
      if (result.status === 'success') {
        evt.refreshTree();
        evt.showSuccessMessage(t('branch.createSuccess', { name: newBranchName.trim() }));
        onClose();
      } else if (result.status === 'reload_error') {
        evt.showErrorMessage(t('branch.reloadError'));
        onClose();
      } else if (result.status === 'error') {
        evt.showErrorMessage(result.message);
        reload();
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
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
      evt.showErrorMessage(err);
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
                    <IconButton size="small" onClick={() => startRename(name)} disabled={loading}
                      title={t("branch.rename")}>
                      <EditIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                    {name !== currentBranch && (
                      <Button size="small" variant="outlined" onClick={() => handleSwitch(name)}
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
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            disabled={loading}
            sx={{ flex: 1, '& .MuiInputBase-input': { py: 0.5, fontSize: '14px' } }}
          />
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            disabled={loading || hasUncommitted || !newBranchName.trim()}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t("branch.create")}
          </Button>
        </Box>

      </Box>
    </ModalWrapper>
  );
}

export default BranchModal;
