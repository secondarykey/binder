import { useState, useEffect, useContext } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContentText, DialogTitle,
  IconButton, List, ListItem, ListItemText, TextField, Tooltip, Typography, Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import { ListBranches, CurrentBranch, SwitchBranch, CreateBranch, RenameBranch, GetModifiedIds,
  ListBranchesByPath, CurrentBranchByPath, SwitchBranchByPath } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * ブランチ操作パネル（ダイアログラッパーなし）
 * BranchModal と OverallHistoryApp の右ペインで共用する
 * @param {{ onClose?: () => void, binderPath?: string }} props
 *   binderPath が指定された場合はバインダー未オープン状態でByPath系APIを使用する
 */
export function BranchPanel({ onClose = () => {}, binderPath = '' }) {
  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  // binderPath が指定された場合はByPath系APIを使用する
  const byPath = !!binderPath;

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
    reload();
    setNewBranchName('');
    setRenamingBranch(null);
    // byPath モードでは未コミット変更チェックをスキップ（バインダー未オープン）
    if (!byPath) {
      GetModifiedIds().then((ids) => {
        setHasUncommitted(ids && ids.length > 0);
      }).catch((err) => showError(err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => {
    if (byPath) {
      ListBranchesByPath(binderPath).then(setBranches).catch((err) => showError(err));
      CurrentBranchByPath(binderPath).then(setCurrentBranch).catch((err) => showError(err));
    } else {
      ListBranches().then(setBranches).catch((err) => showError(err));
      CurrentBranch().then(setCurrentBranch).catch((err) => showError(err));
    }
  };

  const doSwitch = (name) => {
    setConfirmSwitchName(null);
    setLoading(true);
    const switchFn = byPath ? SwitchBranchByPath(binderPath, name) : SwitchBranch(name);
    switchFn.then((result) => {
      if (result.address) evt.changeAddress(result.address);
      if (result.status === 'success') {
        if (!byPath) {
          evt.refreshTree();
        }
        evt.showSuccessMessage(t('branch.switchSuccess', { name }));
        reload();
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
        reload();
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
                  {name === currentBranch && !byPath && (
                    <IconButton size="small" onClick={() => startRename(name)} disabled={loading || hasUncommitted}
                      title={t("branch.rename")}>
                      <EditIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                  )}
                  {name !== currentBranch && (
                    <ActionButton variant="confirm" label={t("branch.switch")} icon={<SwapHorizIcon />}
                      onClick={() => setConfirmSwitchName(name)} disabled={loading || hasUncommitted} size="small" />
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

      {!byPath && <Divider sx={{ my: 2 }} />}

      {/** 新規作成（byPath モードでは非表示: バインダー未オープン状態でのブランチ作成は未サポート） */}
      {!byPath && <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--text-muted)' }}>
        {t("branch.create")}
      </Typography>}
      {!byPath && (
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
          <ActionButton variant="save" label={t("branch.create")} icon={<AddIcon />}
            onClick={() => setConfirmCreateOpen(true)} disabled={loading || hasUncommitted || !newBranchName.trim()}
            size="small" />
        </Box>
      )}

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
          <ActionButton variant="cancel" label={t('common.cancel')} icon={<CloseIcon />} onClick={() => setConfirmSwitchName(null)} />
          <ActionButton variant="confirm" label={t('branch.switch')} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={() => doSwitch(confirmSwitchName)} />
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
          <ActionButton variant="cancel" label={t('common.cancel')} icon={<CloseIcon />} onClick={() => setConfirmCreateOpen(false)} />
          <ActionButton variant="save" label={t('branch.create')} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={doCreate} />
        </DialogActions>
      </Dialog>

    </Box>
  );
}

