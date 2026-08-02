import { useState, useEffect, useContext } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Collapse, FormControl, FormLabel, TextField, Select, MenuItem,
  FormControlLabel, Checkbox, Typography, CircularProgress, IconButton,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MergeIcon from '@mui/icons-material/Merge';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import ModalWrapper from './components/ModalWrapper';
import AuthFields from '../components/AuthFields';
import RemoteSetting from './RemoteSetting';
import { GetUserInfo, RemoteList, GetModifiedIds, CurrentBranch, ListBranches, ListRemoteBranches, MergeFromRemote, MergeFromLocal, ApplyMergeResolution, GetHistoryPatch, Push, PushDocs, GetPublishSettings } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 共有モーダル
 * ブランチ／リモートからの取り込みと、リモートへの送信を1画面にまとめる。
 * shareMode: 'local'（他ブランチから取込） | 'remote'（リモートから取込） | 'push'（リモートへ送信）
 * 取り込み時のみ 3フェーズ: form → conflicts → applying（送信はフォームのみ）
 */
function ShareModal({ open, onClose }) {
  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  // フェーズ管理
  const [phase, setPhase] = useState('form'); // form, conflicts, applying

  // モード管理
  const [shareMode, setShareMode] = useState('remote'); // local, remote, push

  // リモートを相手にするモード（リモート選択・認証情報が必要）
  const usesRemote = shareMode === 'remote' || shareMode === 'push';

  // ローカルモードの状態
  const [localBranches, setLocalBranches] = useState([]);
  const [sourceBranch, setSourceBranch] = useState('');

  // form フェーズの状態（共通）
  const [localBranch, setLocalBranch] = useState('');
  const [merging, setMerging] = useState(false);
  const [hasUncommitted, setHasUncommitted] = useState(false);

  // form フェーズの状態（リモート専用）
  const [remotes, setRemotes] = useState([]);
  const [remoteName, setRemoteName] = useState('');
  const [remoteBranch, setRemoteBranch] = useState('');
  const [remoteBranches, setRemoteBranches] = useState([]);
  const [authType, setAuthType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [sshKey, setSSHKey] = useState('');
  const [save, setSave] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [remoteSettingOpen, setRemoteSettingOpen] = useState(false);

  // form フェーズの状態（送信専用）
  const [sending, setSending] = useState(false);
  const [publishOnly, setPublishOnly] = useState(false);
  const [publishBranch, setPublishBranch] = useState('gh-pages');
  const [publishSubDir, setPublishSubDir] = useState('');

  // conflicts フェーズの状態
  const [conflicts, setConflicts] = useState([]);
  const [resolutions, setResolutions] = useState({});
  const [mergeHashes, setMergeHashes] = useState({});
  const [autoResolved, setAutoResolved] = useState(0);
  const [selectedPath, setSelectedPath] = useState(null);
  const [applying, setApplying] = useState(false);
  const [diffPatch, setDiffPatch] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

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
    setMerging(false);
    setSending(false);

    // 公開設定を読み込み（送信モードで使用）
    GetPublishSettings().then((s) => {
      if (s) {
        setPublishOnly(s.publishOnly || false);
        setPublishBranch(s.publishBranch || 'gh-pages');
        setPublishSubDir(s.publishSubDir || '');
      }
    }).catch((err) => showError(err));

    CurrentBranch().then((name) => {
      setLocalBranch(name || '');
      setRemoteBranch(name || '');
    }).catch((err) => showError(err));

    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => showError(err));

    // ローカルブランチ一覧を取得
    ListBranches().then((branches) => {
      setLocalBranches(branches || []);
    }).catch((err) => showError(err));

    loadRemotes();

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
    }).catch((err) => showError(err));

    setRemoteBranches([]);
    setLoadingBranches(false);
  }, [open]);

  // リモート一覧を取得する。選択中のリモートが消えていた場合のみ先頭へ寄せる
  const loadRemotes = () => {
    RemoteList().then((res) => {
      const list = res || [];
      setRemotes(list);
      setRemoteName((prev) => (list.some((r) => r.name === prev) ? prev : (list[0]?.name ?? '')));
    }).catch((err) => showError(err));
  };

  // ローカルブランチ一覧から現在のブランチを除いたもの
  const selectableBranches = localBranches.filter((b) => b !== localBranch);

  // sourceBranch が未選択またはリストにない場合はリストの先頭を選択
  useEffect(() => {
    if (shareMode !== 'local') return;
    if (selectableBranches.length > 0 && !selectableBranches.includes(sourceBranch)) {
      setSourceBranch(selectableBranches[0]);
    }
  }, [shareMode, selectableBranches]);

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
      showError(err);
    }).finally(() => {
      setLoadingBranches(false);
    });
  };

  const handleMergeResult = (result) => {
    if (result.address) evt.changeAddress(result.address);

    switch (result.status) {
      case 'success':
        evt.showSuccessMessage(
          result.auto_resolved > 0
            ? t('share.mergeSuccess') + ` (${result.auto_resolved} ${t('share.autoResolved')})`
            : t('share.mergeSuccess')
        );
        evt.refreshTree();
        onClose();
        break;
      case 'uptodate':
        evt.showInfoMessage(t('share.upToDate'));
        break;
      case 'conflicts':
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
      case 'version_error':
        showError(t('share.versionNewerError'));
        break;
      case 'reload_error':
        showError(result.message || t('share.reloadError'));
        onClose();
        break;
      default:
        if (result.message) showError(result.message);
        break;
    }
  };

  const handleMerge = () => {
    setMerging(true);

    const promise = shareMode === 'local'
      ? MergeFromLocal(sourceBranch)
      : MergeFromRemote(remoteName, remoteBranch, buildAuthInfo(), save);

    promise.then(handleMergeResult).catch((err) => {
      showError(err);
    }).finally(() => {
      setMerging(false);
    });
  };

  // リモートへ送信する。送信は記録済みの内容のみを送るため、
  // 取り込みと違いコンフリクト解決フェーズには入らない。
  const handleSend = () => {
    if (!remoteName) return;
    setSending(true);

    const info = buildAuthInfo();
    const promise = publishOnly
      ? PushDocs(remoteName, publishBranch, publishSubDir, info, save)
      : Push(remoteName, info, save);

    promise.then(() => {
      evt.showSuccessMessage(publishOnly ? t('share.sendDocsSuccess') : t('share.sendSuccess'));
      onClose();
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setSending(false);
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
      remote_name: shareMode === 'remote' ? remoteName : '',
      remote_branch: shareMode === 'remote' ? remoteBranch : '',
      source_branch: shareMode === 'local' ? sourceBranch : '',
      resolutions: resolutionList,
    }).then((result) => {
      if (result.address) evt.changeAddress(result.address);

      if (result.status === 'success') {
        evt.showSuccessMessage(t('share.mergeSuccess'));
        evt.refreshTree();
        onClose();
      } else if (result.status === 'reload_error') {
        showError(result.message || t('share.reloadError'));
        onClose();
      } else {
        showError(result.message || 'Merge failed');
      }
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setApplying(false);
    });
  };

  // 未記録の変更があると取り込みで衝突するため止める。
  // 送信は記録済みのものだけを送るので、未記録があっても実行できる
  const blockedByUncommitted = hasUncommitted && shareMode !== 'push';

  const isActionDisabled = shareMode === 'local'
    ? merging || !sourceBranch || blockedByUncommitted
    : shareMode === 'push'
      ? sending || !remoteName || !authType
      : merging || !remoteName || !remoteBranch || !authType || blockedByUncommitted;

  const allResolved = conflicts.length > 0 && Object.keys(resolutions).length === conflicts.length;
  const selectedConflict = conflicts.find((c) => c.path === selectedPath);

  // diff 表示対象（テキスト系エンティティ）
  const DIFF_TYPES = ['note', 'diagram', 'template'];
  const canShowDiff = selectedConflict && DIFF_TYPES.includes(selectedConflict.type) && selectedConflict.id;

  // 選択中コンフリクトの ours↔theirs 差分を取得する。
  // コンフリクト解決中はワークツリーが ours のままなので、
  // GetHistoryPatch(type, id, theirsHash) で historical=theirs / source=ours の
  // 差分（theirs→ours）が得られる。削除・追加・バイナリ時はエラーになるため握り潰す。
  useEffect(() => {
    if (phase !== 'conflicts' || !canShowDiff || !mergeHashes.theirs) {
      setDiffPatch(null);
      return;
    }
    setDiffLoading(true);
    GetHistoryPatch(selectedConflict.type, selectedConflict.id, mergeHashes.theirs)
      .then((res) => { setDiffPatch(res?.patch ?? ''); })
      .catch(() => { setDiffPatch(null); })
      .finally(() => { setDiffLoading(false); });
  }, [phase, selectedPath]);

  const actionLabel = (action) => {
    switch (action) {
      case 'modified': return t('share.modified');
      case 'deleted': return t('share.deleted');
      case 'added': return t('share.added');
      default: return action;
    }
  };

  // リモート選択欄。取込・送信の両モードで使う。
  // withConnect は取込時のみ（リモートブランチ一覧の取得ボタン）
  const renderRemoteSelector = (withConnect) => (
    <FormControl size="small">
      <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {t('share.remote')}
        {/** リモートの追加・編集・削除はここから行う */}
        <IconButton size="small" onClick={() => setRemoteSettingOpen(true)}
          title={t('binder.settingRemote')} aria-label="remote-setting">
          <SettingsIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </FormLabel>
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
        {withConnect && (
          <ActionButton variant="confirm" label={t('share.connect')}
            icon={loadingBranches ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={handleLoadBranches} disabled={loadingBranches || !remoteName} size="small" />
        )}
      </Box>
    </FormControl>
  );

  // conflicts フェーズ用のモーダルサイズ
  const modalWidth = phase === 'conflicts' ? '750px' : '550px';
  const modalHeight = phase === 'conflicts' ? '500px' : 'auto';
  const modalMaxHeight = phase === 'conflicts' ? '85vh' : '80vh';

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={phase === 'conflicts' ? t('share.conflictsTitle') : t('share.title')}
      width={modalWidth} height={modalHeight} maxHeight={modalMaxHeight}
      transition="width 0.25s ease"
    >
      {/* form フェーズ */}
      {phase === 'form' && (
        <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* モード切替 */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              value={shareMode}
              exclusive
              onChange={(_, val) => { if (val) setShareMode(val); }}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  px: 1.5,
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  borderColor: 'var(--border-input)',
                  '&.Mui-selected': {
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--selected-bg)',
                  },
                  '&:hover': { backgroundColor: 'var(--hover-overlay)' },
                },
              }}
            >
              <ToggleButton value="local">
                <MergeIcon sx={{ fontSize: '16px', mr: 0.5 }} />{t('share.modeLocal')}
              </ToggleButton>
              <ToggleButton value="remote">
                <CloudDownloadIcon sx={{ fontSize: '16px', mr: 0.5 }} />{t('share.modeRemote')}
              </ToggleButton>
              <ToggleButton value="push">
                <CloudUploadIcon sx={{ fontSize: '16px', mr: 0.5 }} />{t('share.modePush')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {blockedByUncommitted && (
            <Alert severity="warning" sx={{ fontSize: '13px' }}>
              {t('share.uncommittedWarning')}
            </Alert>
          )}

          {/* ローカルモード / リモートモード（Collapseでアニメーション切替） */}
          <Box>
            <Collapse in={shareMode === 'local'} timeout={150} unmountOnExit>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl size="small">
                  <FormLabel>{t('share.sourceBranch')}</FormLabel>
                  {selectableBranches.length > 0 ? (
                    <Select
                      value={sourceBranch}
                      onChange={(e) => setSourceBranch(e.target.value)}
                      size="small"
                    >
                      {selectableBranches.map((b) => (
                        <MenuItem key={b} value={b}>{b}</MenuItem>
                      ))}
                    </Select>
                  ) : (
                    <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)', mt: 0.5 }}>
                      {/* 他にブランチがない場合 */}
                      —
                    </Typography>
                  )}
                </FormControl>

                <FormControl size="small">
                  <FormLabel>{t('share.targetBranch')}</FormLabel>
                  <TextField size="small" value={localBranch} InputProps={{ readOnly: true }} />
                </FormControl>
              </Box>
            </Collapse>

            <Collapse in={shareMode === 'remote'} timeout={150} unmountOnExit>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {renderRemoteSelector(true)}

                <FormControl size="small">
                  <FormLabel>{t('share.remoteBranch')}</FormLabel>
                  {remoteBranches.length > 0 ? (
                    <Select value={remoteBranch} onChange={(e) => setRemoteBranch(e.target.value)} size="small">
                      {remoteBranches.map((b) => (<MenuItem key={b} value={b}>{b}</MenuItem>))}
                    </Select>
                  ) : (
                    <TextField size="small" value={remoteBranch} onChange={(e) => setRemoteBranch(e.target.value)} />
                  )}
                </FormControl>

                <FormControl size="small">
                  <FormLabel>{t('share.localBranch')}</FormLabel>
                  <TextField size="small" value={localBranch} InputProps={{ readOnly: true }} />
                </FormControl>
              </Box>
            </Collapse>

            <Collapse in={shareMode === 'push'} timeout={150} unmountOnExit>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {renderRemoteSelector(false)}

                <FormControl size="small">
                  <FormLabel>{t('share.currentBranch')}</FormLabel>
                  <TextField size="small" value={localBranch} InputProps={{ readOnly: true }} />
                </FormControl>

                {/* 公開データのみ送信する場合の送り先 */}
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox checked={publishOnly} onChange={(e) => setPublishOnly(e.target.checked)} size="small" />
                    }
                    label={t('share.publishOnly')}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
                  />
                  {publishOnly && (
                    <>
                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                        <FormLabel>{t('share.publishBranch')}</FormLabel>
                        <TextField size="small" value={publishBranch}
                          onChange={(e) => setPublishBranch(e.target.value)} />
                      </FormControl>
                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                        <FormLabel>{t('share.publishSubDir')}</FormLabel>
                        <TextField size="small" value={publishSubDir}
                          onChange={(e) => setPublishSubDir(e.target.value)}
                          placeholder={t('share.publishSubDirHint')} />
                      </FormControl>
                    </>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            {shareMode === 'push' ? (
              <ActionButton variant="confirm" label={t('share.sendButton')}
                icon={sending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                onClick={handleSend} disabled={isActionDisabled} />
            ) : (
              <ActionButton variant="confirm" label={t('share.mergeButton')}
                icon={merging ? <CircularProgress size={16} /> : (shareMode === 'local' ? <MergeIcon /> : <CloudDownloadIcon />)}
                onClick={handleMerge} disabled={isActionDisabled} />
            )}
          </Box>

          {/* 認証（リモートを相手にするモードでのみ表示） */}
          <Collapse in={usesRemote} timeout={150} unmountOnExit>
            <Accordion
              expanded={authExpanded}
              onChange={(_, expanded) => setAuthExpanded(expanded)}
              disableGutters
              sx={{ backgroundColor: 'transparent', boxShadow: 'none', '&::before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--text-secondary)' }} />}>
                <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {t('share.authType')}
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
                  label={t('share.saveCredentials')}
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
                />
              </AccordionDetails>
            </Accordion>
          </Collapse>

          {/** リモート設定（追加・編集・削除） */}
          <RemoteSetting
            open={remoteSettingOpen}
            onClose={() => setRemoteSettingOpen(false)}
            onChanged={loadRemotes}
          />
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
                {autoResolved} {t('share.autoResolved')}
              </Typography>
            )}
            <ListSubheader sx={{
              backgroundColor: 'var(--bg-panel)', color: 'var(--text-secondary)',
              fontSize: '11px', lineHeight: '28px',
            }}>
              {t('share.selectResolution')} ({Object.keys(resolutions).length}/{conflicts.length})
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
              <ActionButton variant="save" label={t('share.applyResolution')}
                icon={applying ? <CircularProgress size={14} /> : <CheckIcon />}
                onClick={handleApplyResolution} disabled={!allResolved || applying} size="small" />
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
                  <span>{t('share.localLabel')}: {actionLabel(selectedConflict.ours_action)}</span>
                  <span>{shareMode === 'local' ? t('share.sourceLabel') : t('share.remoteLabel')}: {actionLabel(selectedConflict.their_action)}</span>
                </Box>

                <ToggleButtonGroup
                  value={resolutions[selectedConflict.path] || null}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setResolutions((prev) => ({ ...prev, [selectedConflict.path]: val }));
                  }}
                  sx={{
                    mt: 2,
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontSize: '13px',
                      px: 3,
                      color: 'var(--text-muted)',
                      borderColor: 'var(--border-input)',
                      '&.Mui-selected': {
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--selected-bg)',
                      },
                      '&:hover': { backgroundColor: 'var(--hover-overlay)' },
                    },
                  }}
                >
                  <ToggleButton value="ours">
                    {shareMode === 'local' ? t('share.keepOursLocal') : t('share.keepOurs')}
                  </ToggleButton>
                  <ToggleButton value="theirs">
                    {shareMode === 'local' ? t('share.keepTheirsLocal') : t('share.keepTheirs')}
                  </ToggleButton>
                  {['note', 'diagram', 'template'].includes(selectedConflict.type) && (
                    <ToggleButton value="both">
                      {t('share.keepBoth')}
                    </ToggleButton>
                  )}
                </ToggleButtonGroup>

                {resolutions[selectedConflict.path] && (
                  <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)', mt: 1 }}>
                    → {resolutions[selectedConflict.path] === 'ours'
                      ? (shareMode === 'local' ? t('share.keepOursLocal') : t('share.keepOurs'))
                      : resolutions[selectedConflict.path] === 'theirs'
                        ? (shareMode === 'local' ? t('share.keepTheirsLocal') : t('share.keepTheirs'))
                        : t('share.keepBoth')}
                  </Typography>
                )}

                {/* ours↔theirs の差分（テキスト系のみ） */}
                {canShowDiff && (
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                      <Typography sx={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {t('share.diffTitle')}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, fontSize: '11px' }}>
                        <span style={{ color: '#4caf50' }}>+ {t('share.localLabel')}</span>
                        <span style={{ color: '#f44336' }}>
                          - {shareMode === 'local' ? t('share.sourceLabel') : t('share.remoteLabel')}
                        </span>
                      </Box>
                    </Box>
                    {diffLoading ? (
                      <CircularProgress size={18} sx={{ mt: 1 }} />
                    ) : diffPatch ? (
                      <DiffView patch={diffPatch} />
                    ) : (
                      <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {t('share.diffUnavailable')}
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('share.selectFile')}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </ModalWrapper>
  );
}

/**
 * DiffView は unified patch 文字列を行頭記号で色付けして表示する。
 * + 行（ローカルのみ）=緑、- 行（リモート/マージ元のみ）=赤、@@ ヘッダ=淡色。
 * ファイルヘッダ（diff/index/---/+++）は表示しない。
 */
function DiffView({ patch }) {
  const lines = (patch || '').split('\n');
  return (
    <Box sx={{
      maxHeight: '260px', overflow: 'auto',
      fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5,
      backgroundColor: 'var(--bg-overlay)',
      border: '1px solid var(--border-primary)',
      borderRadius: '4px', p: 1, whiteSpace: 'pre',
    }}>
      {lines.map((line, i) => {
        if (line.startsWith('diff ') || line.startsWith('index ') ||
            line.startsWith('--- ') || line.startsWith('+++ ')) {
          return null;
        }
        let color = 'var(--text-secondary)';
        if (line.startsWith('@@')) color = 'var(--text-muted)';
        else if (line.startsWith('+')) color = '#4caf50';
        else if (line.startsWith('-')) color = '#f44336';
        return <div key={i} style={{ color }}>{line || ' '}</div>;
      })}
    </Box>
  );
}

export default ShareModal;
