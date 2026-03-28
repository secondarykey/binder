import { useState, useEffect, useContext } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, FormControl, FormLabel, TextField, Select, MenuItem,
  FormControlLabel, Checkbox, Typography, CircularProgress,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import ModalWrapper from './components/ModalWrapper';
import AuthFields from '../components/AuthFields';
import { GetUserInfo, RemoteList, GetModifiedIds, CurrentBranch, ListRemoteBranches, MergeFromRemote } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

/**
 * Mergeモーダル
 * リモートブランチからfetch + fast-forward マージを実行
 */
function MergeModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { t } = useTranslation();

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

  useEffect(() => {
    if (!open) return;

    // リモート一覧を取得
    RemoteList().then((res) => {
      const list = res || [];
      setRemotes(list);
      if (list.length > 0) setRemoteName(list[0].name);
    }).catch((err) => evt.showErrorMessage(err));

    // 現在のブランチ名を取得
    CurrentBranch().then((name) => {
      setLocalBranch(name || '');
      setRemoteBranch(name || '');
    }).catch((err) => evt.showErrorMessage(err));

    // 未コミット変更のチェック
    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => evt.showErrorMessage(err));

    // 保存済みUserInfoを読み込み
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

    // 状態リセット
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
      switch (result.status) {
        case 'success':
          evt.showSuccessMessage(t('merge.mergeSuccess'));
          if (result.address) evt.changeAddress(result.address);
          evt.refreshTree();
          onClose();
          break;
        case 'uptodate':
          evt.showInfoMessage(t('merge.upToDate'));
          if (result.address) evt.changeAddress(result.address);
          break;
        case 'diverged':
          evt.showWarningMessage(t('merge.diverged'));
          if (result.address) evt.changeAddress(result.address);
          break;
        case 'reload_error':
          evt.showErrorMessage(result.message || t('merge.reloadError'));
          onClose();
          break;
        default:
          if (result.message) {
            evt.showErrorMessage(result.message);
          }
          if (result.address) evt.changeAddress(result.address);
          break;
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setMerging(false);
    });
  };

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={t('merge.title')}
      width="550px" height="auto" maxHeight="80vh"
    >
      <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* 未コミット警告 */}
        {hasUncommitted && (
          <Alert severity="warning" sx={{ fontSize: '13px' }}>
            {t('merge.uncommittedWarning')}
          </Alert>
        )}

        {/* リモート選択 + 接続ボタン */}
        <FormControl size="small">
          <FormLabel>{t('merge.remote')}</FormLabel>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Select
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            >
              {remotes.map((r) => (
                <MenuItem key={r.name} value={r.name}>{r.name} ({r.url})</MenuItem>
              ))}
            </Select>
            <Button
              variant="text"
              size="small"
              onClick={handleLoadBranches}
              disabled={loadingBranches || !remoteName || !authType}
              sx={{ textTransform: 'none', whiteSpace: 'nowrap', fontSize: '12px' }}
            >
              {loadingBranches ? <CircularProgress size={16} /> : t('merge.connect')}
            </Button>
          </Box>
        </FormControl>

        {/* リモートブランチ */}
        <FormControl size="small">
          <FormLabel>{t('merge.remoteBranch')}</FormLabel>
          {remoteBranches.length > 0 ? (
            <Select
              value={remoteBranch}
              onChange={(e) => setRemoteBranch(e.target.value)}
              size="small"
            >
              {remoteBranches.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          ) : (
            <TextField
              size="small"
              value={remoteBranch}
              onChange={(e) => setRemoteBranch(e.target.value)}
            />
          )}
        </FormControl>

        {/* ローカルブランチ（読み取り専用） */}
        <FormControl size="small">
          <FormLabel>{t('merge.localBranch')}</FormLabel>
          <TextField size="small" value={localBranch} InputProps={{ readOnly: true }} />
        </FormControl>

        {/* マージボタン */}
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

        {/* 認証情報（折りたたみ） */}
        <Accordion
          expanded={authExpanded}
          onChange={(_, expanded) => setAuthExpanded(expanded)}
          disableGutters
          sx={{
            backgroundColor: 'transparent',
            boxShadow: 'none',
            '&::before': { display: 'none' },
          }}
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
    </ModalWrapper>
  );
}

export default MergeModal;
