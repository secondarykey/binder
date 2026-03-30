import { useState, useEffect, useContext } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, FormControl, FormLabel, TextField, Select, MenuItem,
  FormControlLabel, Checkbox, Typography, CircularProgress,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import ModalWrapper from './components/ModalWrapper';
import AuthFields from '../components/AuthFields';
import { GetUserInfo, RemoteList, GetModifiedIds, CurrentBranch, ListRemoteBranches, MergeFromRemote, ApplyMergeResolution } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

/**
 * Mergeモーダル
 * 3フェーズ: form → conflicts → applying
 */
function MergeModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  // フェーズ管理
  const [phase, setPhase] = useState('form'); // form, conflicts, applying

  // form フェーズの状態
  const [remotes, setRemotes] = useState([]);
  const [remoteName, setRemoteName] = useState('');
  const [localBranch, setLocalBranch] = useState('');
  const [remoteBranch, setRemoteBranch] = useState('');
  const [remoteBranches, setRemoteBranches] = useState([]);
  const [authType, setAuthType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [sshKey, setSSHKey] = useState('');
  const [save, setSave] = useState(false);
  const [merging, setMerging] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(true);
  const [hasUncommitted, setHasUncommitted] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // conflicts フェーズの状態
  const [conflicts, setConflicts] = useState([]);
  const [resolutions, setResolutions] = useState({});
  const [mergeHashes, setMergeHashes] = useState({});
  const [autoResolved, setAutoResolved] = useState(0);
  const [selectedPath, setSelectedPath] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;

    // フェーズリセット
    setPhase('form');
    setConflicts([]);
    setResolutions({});
    setMergeHashes({});
    setAutoResolved(0);
    setSelectedPath(null);
    setApplying(false);

    RemoteList().then((res) => {
      const list = res || [];
      setRemotes(list);
      if (list.length > 0) setRemoteName(list[0].name);
    }).catch((err) => evt.showErrorMessage(err));

    CurrentBranch().then((name) => {
      setLocalBranch(name || '');
      setRemoteBranch(name || '');
    }).catch((err) => evt.showErrorMessage(err));

    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => evt.showErrorMessage(err));

    GetUserInfo().then((info) => {
      setUserName(info.name || '');
      setUserEmail(info.email || '');
      setAuthType(info.auth_type || '');
      setUsername(info.username || '');
      setPassword(info.password || '');
      setToken(info.token || '');
      setPassphrase(info.passphrase || '');
      if (info.bytes) {
        const decoder = new TextDecoder();
        setSSHKey(decoder.decode(new Uint8Array(info.bytes)));
      } else {
        setSSHKey('');
      }
      const at = info.auth_type || '';
      const hasValues =
        (at === 'basic' && (info.username || info.password)) ||
        (at === 'token' && info.token) ||
        (at === 'ssh_key' && info.bytes) ||
        (at === 'ssh_agent');
      setAuthExpanded(!hasValues);
    }).catch((err) => evt.showErrorMessage(err));

    setRemoteBranches([]);
    setMerging(false);
    setLoadingBranches(false);
  }, [open]);

  const buildAuthInfo = () => ({
    name: userName,
    email: userEmail,
    auth_type: authType,
    username,
    password,
    token,
    passphrase,
    filename: '',
    bytes: Array.from(new TextEncoder().encode(sshKey)),
  });

  const handleLoadBranches = () => {
    if (!remoteName || !authType) return;
    const remote = remotes.find((r) => r.name === remoteName);
    if (!remote) return;

    setLoadingBranches(true);
    ListRemoteBranches(remote.url, buildAuthInfo()).then((branches) => {
      setRemoteBranches(branches || []);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoadingBranches(false);
    });
  };

  const handleMerge = () => {
    if (!remoteName || !remoteBranch) return;

    setMerging(true);
    MergeFromRemote(remoteName, remoteBranch, buildAuthInfo(), save).then((result) => {
      if (result.address) evt.changeAddress(result.address);

      switch (result.status) {
        case 'success':
          evt.showSuccessMessage(
            result.auto_resolved > 0
              ? t('merge.mergeSuccess') + ` (${result.auto_resolved} ${t('merge.autoResolved')})`
              : t('merge.mergeSuccess')
          );
          evt.refreshTree();
          onClose();
          break;
        case 'uptodate':
          evt.showInfoMessage(t('merge.upToDate'));
          break;
        case 'conflicts':
          // コンフリクトフェーズに遷移
          setConflicts(result.conflicts || []);
          setMergeHashes({
            base: result.base_hash,
            ours: result.ours_hash,
            theirs: result.theirs_hash,
          });
          setAutoResolved(result.auto_resolved || 0);
          setResolutions({});
          setSelectedPath(result.conflicts && result.conflicts.length > 0 ? result.conflicts[0].path : null);
          setPhase('conflicts');
          break;
        case 'reload_error':
          evt.showErrorMessage(result.message || t('merge.reloadError'));
          onClose();
          break;
        default:
          if (result.message) evt.showErrorMessage(result.message);
          break;
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setMerging(false);
    });
  };

  const handleApplyResolution = () => {
    setApplying(true);
    const resolutionList = Object.entries(resolutions).map(([path, resolution]) => ({
      path, resolution,
    }));

    ApplyMergeResolution({
      base_hash: mergeHashes.base,
      ours_hash: mergeHashes.ours,
      theirs_hash: mergeHashes.theirs,
      remote_name: remoteName,
      remote_branch: remoteBranch,
      resolutions: resolutionList,
    }).then((result) => {
      if (result.address) evt.changeAddress(result.address);

      if (result.status === 'success') {
        evt.showSuccessMessage(t('merge.mergeSuccess'));
        evt.refreshTree();
        onClose();
      } else if (result.status === 'reload_error') {
        evt.showErrorMessage(result.message || t('merge.reloadError'));
        onClose();
      } else {
        evt.showErrorMessage(result.message || 'Merge failed');
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setApplying(false);
    });
  };

  const allResolved = conflicts.length > 0 && Object.keys(resolutions).length === conflicts.length;
  const selectedConflict = conflicts.find((c) => c.path === selectedPath);

  const actionLabel = (action) => {
    switch (action) {
      case 'modified': return t('merge.modified');
      case 'deleted': return t('merge.deleted');
      case 'added': return t('merge.added');
      default: return action;
    }
  };

  // conflicts フェーズ用のモーダルサイズ
  const modalWidth = phase === 'conflicts' ? '750px' : '550px';
  const modalHeight = phase === 'conflicts' ? '500px' : 'auto';
  const modalMaxHeight = phase === 'conflicts' ? '85vh' : '80vh';

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={phase === 'conflicts' ? t('merge.conflictsTitle') : t('merge.title')}
      width={modalWidth} height={modalHeight} maxHeight={modalMaxHeight}
    >
      {/* form フェーズ */}
      {phase === 'form' && (
        <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {hasUncommitted && (
            <Alert severity="warning" sx={{ fontSize: '13px' }}>
              {t('merge.uncommittedWarning')}
            </Alert>
          )}

          <FormControl size="small">
            <FormLabel>{t('merge.remote')}</FormLabel>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 0 }}>
              <Select
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 0 }}
              >
                {remotes.map((r) => (
                  <MenuItem key={r.name} value={r.name}>{r.name} ({r.url})</MenuItem>
                ))}
              </Select>
              <Button
                variant="text" size="small"
                onClick={handleLoadBranches}
                disabled={loadingBranches || !remoteName || !authType}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', fontSize: '12px' }}
              >
                {loadingBranches ? <CircularProgress size={16} /> : t('merge.connect')}
              </Button>
            </Box>
          </FormControl>

          <FormControl size="small">
            <FormLabel>{t('merge.remoteBranch')}</FormLabel>
            {remoteBranches.length > 0 ? (
              <Select value={remoteBranch} onChange={(e) => setRemoteBranch(e.target.value)} size="small">
                {remoteBranches.map((b) => (<MenuItem key={b} value={b}>{b}</MenuItem>))}
              </Select>
            ) : (
              <TextField size="small" value={remoteBranch} onChange={(e) => setRemoteBranch(e.target.value)} />
            )}
          </FormControl>

          <FormControl size="small">
            <FormLabel>{t('merge.localBranch')}</FormLabel>
            <TextField size="small" value={localBranch} InputProps={{ readOnly: true }} />
          </FormControl>

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <Button
              variant="outlined"
              startIcon={merging ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
              onClick={handleMerge}
              disabled={merging || !remoteName || !remoteBranch || !authType || hasUncommitted}
              sx={{ textTransform: 'none' }}
            >
              {t('merge.mergeButton')}
            </Button>
          </Box>

          <Accordion
            expanded={authExpanded}
            onChange={(_, expanded) => setAuthExpanded(expanded)}
            disableGutters
            sx={{ backgroundColor: 'transparent', boxShadow: 'none', '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--text-secondary)' }} />}>
              <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('merge.authType')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
              <AuthFields
                authType={authType} onAuthTypeChange={setAuthType}
                username={username} onUsernameChange={setUsername}
                password={password} onPasswordChange={setPassword}
                token={token} onTokenChange={setToken}
                passphrase={passphrase} onPassphraseChange={setPassphrase}
                sshKey={sshKey} onSSHKeyChange={setSSHKey}
              />
              <FormControlLabel
                control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} size="small" />}
                label={t('merge.saveCredentials')}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* conflicts フェーズ */}
      {phase === 'conflicts' && (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 左パネル: コンフリクトファイル一覧 */}
          <Box sx={{
            width: 280, minWidth: 280,
            backgroundColor: 'var(--bg-panel)',
            overflowY: 'auto',
            borderRight: '1px solid var(--border-primary)',
          }}>
            {autoResolved > 0 && (
              <Typography sx={{ fontSize: '11px', color: 'var(--text-secondary)', px: 2, pt: 1 }}>
                {autoResolved} {t('merge.autoResolved')}
              </Typography>
            )}
            <ListSubheader sx={{
              backgroundColor: 'var(--bg-panel)', color: 'var(--text-secondary)',
              fontSize: '11px', lineHeight: '28px',
            }}>
              {t('merge.selectResolution')} ({Object.keys(resolutions).length}/{conflicts.length})
            </ListSubheader>
            <List dense disablePadding>
              {conflicts.map((c) => (
                <ListItemButton
                  key={c.path}
                  selected={c.path === selectedPath}
                  onClick={() => setSelectedPath(c.path)}
                  sx={{
                    py: 0.5, px: 2,
                    '&.Mui-selected': { backgroundColor: 'var(--selected-bg)' },
                  }}
                >
                  <ListItemText
                    primary={c.name || c.path}
                    secondary={c.type !== 'other' ? c.type : null}
                    primaryTypographyProps={{ fontSize: '12px', noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '10px' }}
                  />
                  {resolutions[c.path] && (
                    <CheckCircleIcon sx={{ fontSize: '14px', color: 'var(--text-secondary)', ml: 1 }} />
                  )}
                </ListItemButton>
              ))}
            </List>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={handleApplyResolution}
                disabled={!allResolved || applying}
                startIcon={applying ? <CircularProgress size={14} /> : null}
                sx={{ textTransform: 'none', fontSize: '12px' }}
              >
                {t('merge.applyResolution')}
              </Button>
            </Box>
          </Box>

          {/* 右パネル: 選択ファイルの詳細 */}
          <Box sx={{
            flex: 1, p: 3, overflow: 'auto',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {selectedConflict ? (
              <>
                <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {selectedConflict.path}
                </Typography>

                {selectedConflict.type !== 'other' && (
                  <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedConflict.type}: {selectedConflict.id}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>{t('merge.localLabel')}: {actionLabel(selectedConflict.ours_action)}</span>
                  <span>{t('merge.remoteLabel')}: {actionLabel(selectedConflict.their_action)}</span>
                </Box>

                <ToggleButtonGroup
                  value={resolutions[selectedConflict.path] || null}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setResolutions((prev) => ({ ...prev, [selectedConflict.path]: val }));
                  }}
                  sx={{ mt: 2 }}
                >
                  <ToggleButton value="ours" sx={{ textTransform: 'none', fontSize: '13px', px: 3 }}>
                    {t('merge.keepOurs')}
                  </ToggleButton>
                  <ToggleButton value="theirs" sx={{ textTransform: 'none', fontSize: '13px', px: 3 }}>
                    {t('merge.keepTheirs')}
                  </ToggleButton>
                  {['note', 'diagram', 'template'].includes(selectedConflict.type) && (
                    <ToggleButton value="both" sx={{ textTransform: 'none', fontSize: '13px', px: 3 }}>
                      {t('merge.keepBoth')}
                    </ToggleButton>
                  )}
                </ToggleButtonGroup>

                {resolutions[selectedConflict.path] && (
                  <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)', mt: 1 }}>
                    → {resolutions[selectedConflict.path] === 'ours' ? t('merge.keepOurs') : resolutions[selectedConflict.path] === 'theirs' ? t('merge.keepTheirs') : t('merge.keepBoth')}
                  </Typography>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('merge.selectFile')}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </ModalWrapper>
  );
}

export default MergeModal;
