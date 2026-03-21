import { useState, useEffect, useContext } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, FormControl, FormLabel, TextField, Select, MenuItem,
  FormControlLabel, Checkbox, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import ModalWrapper from './components/ModalWrapper';
import { GetUserInfo, RemoteList, Push, CurrentBranch } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

const AUTH_TYPES = [
  { value: 'basic', labelKey: 'push.authBasic' },
  { value: 'token', labelKey: 'push.authToken' },
  { value: 'ssh_file', labelKey: 'push.authSSHFile' },
  { value: 'ssh_agent', labelKey: 'push.authSSHAgent' },
];

/**
 * Pushモーダル
 * 保存済み認証情報を初期値として表示し、ユーザーが確認・編集してからPush実行
 */
function PushModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [remotes, setRemotes] = useState([]);
  const [remoteName, setRemoteName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [authType, setAuthType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [filename, setFilename] = useState('');
  const [save, setSave] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(true);

  // UserInfoのname/email（Push時にそのまま渡す）
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
      setBranchName(name || '');
    }).catch((err) => evt.showErrorMessage(err));

    // 保存済みUserInfo（認証情報含む）を読み込み
    GetUserInfo().then((info) => {
      setUserName(info.name || '');
      setUserEmail(info.email || '');
      setAuthType(info.auth_type || '');
      setUsername(info.username || '');
      setPassword(info.password || '');
      setToken(info.token || '');
      setPassphrase(info.passphrase || '');
      setFilename(info.filename || '');
      // 認証種別に関連する値が入力済みなら折りたたむ
      const at = info.auth_type || '';
      const hasValues =
        (at === 'basic' && (info.username || info.password)) ||
        (at === 'token' && info.token) ||
        (at === 'ssh_file' && (info.filename || info.passphrase)) ||
        (at === 'ssh_agent');
      setAuthExpanded(!hasValues);
    }).catch((err) => evt.showErrorMessage(err));

  }, [open]);

  const handlePush = () => {
    if (!remoteName) return;

    setPushing(true);
    const info = {
      name: userName,
      email: userEmail,
      auth_type: authType,
      username,
      password,
      token,
      passphrase,
      filename,
      bytes: null,
    };

    Push(remoteName, info, save).then(() => {
      evt.showSuccessMessage(t('push.pushSuccess'));
      onClose();
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setPushing(false);
    });
  };

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={t('push.title')}
      width="500px" height="auto" maxHeight="80vh"
    >
      <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* リモート選択 */}
        <FormControl size="small">
          <FormLabel>{t('push.remote')}</FormLabel>
          <Select
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            size="small"
          >
            {remotes.map((r) => (
              <MenuItem key={r.name} value={r.name}>{r.name} ({r.url})</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Pushボタン（中央表示） */}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={handlePush}
            disabled={pushing || !remoteName || !authType}
            sx={{ textTransform: 'none' }}
          >
            {t('push.pushButton')}
          </Button>
        </Box>

        {/* ブランチ名（読み取り専用） */}
        <FormControl size="small">
          <FormLabel>{t('binder.currentBranch')}</FormLabel>
          <TextField size="small" value={branchName} InputProps={{ readOnly: true }} />
        </FormControl>

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
              {t('push.authType')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
            <FormControl size="small">
              <Select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
                size="small"
              >
                <MenuItem value="">&nbsp;</MenuItem>
                {AUTH_TYPES.map((at) => (
                  <MenuItem key={at.value} value={at.value}>{t(at.labelKey)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Basic認証フィールド */}
            {authType === 'basic' && (
              <>
                <FormControl size="small">
                  <FormLabel>{t('push.username')}</FormLabel>
                  <TextField size="small" value={username} onChange={(e) => setUsername(e.target.value)} />
                </FormControl>
                <FormControl size="small">
                  <FormLabel>{t('push.password')}</FormLabel>
                  <TextField size="small" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </FormControl>
              </>
            )}

            {/* トークン認証フィールド */}
            {authType === 'token' && (
              <FormControl size="small">
                <FormLabel>{t('push.token')}</FormLabel>
                <TextField size="small" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
              </FormControl>
            )}

            {/* SSH鍵ファイルフィールド */}
            {authType === 'ssh_file' && (
              <>
                <FormControl size="small">
                  <FormLabel>{t('push.filename')}</FormLabel>
                  <TextField size="small" value={filename} onChange={(e) => setFilename(e.target.value)} />
                </FormControl>
                <FormControl size="small">
                  <FormLabel>{t('push.passphrase')}</FormLabel>
                  <TextField size="small" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
                </FormControl>
              </>
            )}

            {/* SSHエージェント: 追加入力なし */}

            {/* 保存チェックボックス */}
            <FormControlLabel
              control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} size="small" />}
              label={t('push.saveCredentials')}
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
            />
          </AccordionDetails>
        </Accordion>

      </Box>
    </ModalWrapper>
  );
}

export default PushModal;
