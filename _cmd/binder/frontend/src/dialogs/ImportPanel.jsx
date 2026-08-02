import { useState, useEffect, useContext } from 'react';
import {
  Alert, Box, Collapse, FormControl, FormLabel, TextField, Select, MenuItem,
  Typography, CircularProgress,
  List, ListItemButton, ListItemText, ListSubheader, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import MergeIcon from '@mui/icons-material/Merge';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import RemoteSelect from '../components/RemoteSelect';
import AuthAccordion from '../components/AuthAccordion';
import { GetModifiedIds, CurrentBranch, ListBranches, ListRemoteBranches, MergeFromRemote, MergeFromLocal, ApplyMergeResolution, GetHistoryPatch } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 取り込みパネル（全体履歴の右ペインのタブ）
 * importMode: 'local'（他ブランチから取込） | 'remote'（リモートから取込）
 * 2フェーズ: form → conflicts
 *
 * @param {{ onDone?: () => void }} props
 *   onDone は取り込みが完了した時に呼ばれる（ホスト側の後始末用）
 */
function ImportPanel({ onDone = () => {} }) {
  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [phase, setPhase] = useState('form'); // form, conflicts
  const [importMode, setImportMode] = useState('remote'); // local, remote

  // form フェーズの状態
  const [localBranches, setLocalBranches] = useState([]);
  const [sourceBranch, setSourceBranch] = useState('');
  const [localBranch, setLocalBranch] = useState('');
  const [merging, setMerging] = useState(false);
  const [hasUncommitted, setHasUncommitted] = useState(false);

  // form フェーズの状態（リモート専用）
  const [remoteName, setRemoteName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteBranch, setRemoteBranch] = useState('');
  const [remoteBranches, setRemoteBranches] = useState([]);
  const [authInfo, setAuthInfo] = useState(null);
  const [save, setSave] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

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
    CurrentBranch().then((name) => {
      setLocalBranch(name || '');
      setRemoteBranch(name || '');
    }).catch((err) => showError(err));

    GetModifiedIds().then((ids) => {
      setHasUncommitted(ids && ids.length > 0);
    }).catch((err) => showError(err));

    ListBranches().then((branches) => {
      setLocalBranches(branches || []);
    }).catch((err) => showError(err));
  }, []);

  // ローカルブランチ一覧から現在のブランチを除いたもの
  const selectableBranches = localBranches.filter((b) => b !== localBranch);

  // sourceBranch が未選択またはリストにない場合はリストの先頭を選択
  useEffect(() => {
    if (importMode !== 'local') return;
    if (selectableBranches.length > 0 && !selectableBranches.includes(sourceBranch)) {
      setSourceBranch(selectableBranches[0]);
    }
  }, [importMode, selectableBranches]);

  const handleRemoteChange = (name, url) => {
    setRemoteName(name);
    setRemoteUrl(url);
  };

  const handleLoadBranches = () => {
    if (!remoteUrl || !authInfo?.auth_type) return;

    setLoadingBranches(true);
    ListRemoteBranches(remoteUrl, authInfo).then((branches) => {
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
        onDone();
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
        onDone();
        break;
      default:
        if (result.message) showError(result.message);
        break;
    }
  };

  const handleMerge = () => {
    setMerging(true);

    const promise = importMode === 'local'
      ? MergeFromLocal(sourceBranch)
      : MergeFromRemote(remoteName, remoteBranch, authInfo, save);

    promise.then(handleMergeResult).catch((err) => {
      showError(err);
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
      remote_name: importMode === 'remote' ? remoteName : '',
      remote_branch: importMode === 'remote' ? remoteBranch : '',
      source_branch: importMode === 'local' ? sourceBranch : '',
      resolutions: resolutionList,
    }).then((result) => {
      if (result.address) evt.changeAddress(result.address);

      if (result.status === 'success') {
        evt.showSuccessMessage(t('share.mergeSuccess'));
        evt.refreshTree();
        onDone();
      } else if (result.status === 'reload_error') {
        showError(result.message || t('share.reloadError'));
        onDone();
      } else {
        showError(result.message || 'Merge failed');
      }
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setApplying(false);
    });
  };

  // 未記録の変更があると取り込みで衝突するため止める
  const isMergeDisabled = importMode === 'local'
    ? merging || !sourceBranch || hasUncommitted
    : merging || !remoteName || !remoteBranch || !authInfo?.auth_type || hasUncommitted;

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

  /* conflicts フェーズ */
  if (phase === 'conflicts') {
    return (
      <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* 左パネル: コンフリクトファイル一覧 */}
        <Box sx={{
          width: 240, minWidth: 240,
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
          flex: 1, p: 2, overflow: 'auto',
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
                <span>{importMode === 'local' ? t('share.sourceLabel') : t('share.remoteLabel')}: {actionLabel(selectedConflict.their_action)}</span>
              </Box>

              <ToggleButtonGroup
                value={resolutions[selectedConflict.path] || null}
                exclusive
                onChange={(_, val) => {
                  if (val) setResolutions((prev) => ({ ...prev, [selectedConflict.path]: val }));
                }}
                sx={{
                  mt: 1,
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontSize: '13px',
                    px: 2,
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
                  {importMode === 'local' ? t('share.keepOursLocal') : t('share.keepOurs')}
                </ToggleButton>
                <ToggleButton value="theirs">
                  {importMode === 'local' ? t('share.keepTheirsLocal') : t('share.keepTheirs')}
                </ToggleButton>
                {['note', 'diagram', 'template'].includes(selectedConflict.type) && (
                  <ToggleButton value="both">
                    {t('share.keepBoth')}
                  </ToggleButton>
                )}
              </ToggleButtonGroup>

              {resolutions[selectedConflict.path] && (
                <Typography sx={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  → {resolutions[selectedConflict.path] === 'ours'
                    ? (importMode === 'local' ? t('share.keepOursLocal') : t('share.keepOurs'))
                    : resolutions[selectedConflict.path] === 'theirs'
                      ? (importMode === 'local' ? t('share.keepTheirsLocal') : t('share.keepTheirs'))
                      : t('share.keepBoth')}
                </Typography>
              )}

              {/* ours↔theirs の差分（テキスト系のみ） */}
              {canShowDiff && (
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {t('share.diffTitle')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, fontSize: '11px' }}>
                      <span style={{ color: '#4caf50' }}>+ {t('share.localLabel')}</span>
                      <span style={{ color: '#f44336' }}>
                        - {importMode === 'local' ? t('share.sourceLabel') : t('share.remoteLabel')}
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
    );
  }

  /* form フェーズ */
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* モード切替 */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={importMode}
          exclusive
          onChange={(_, val) => { if (val) setImportMode(val); }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: 2,
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
        </ToggleButtonGroup>
      </Box>

      {hasUncommitted && (
        <Alert severity="warning" sx={{ fontSize: '13px' }}>
          {t('share.uncommittedWarning')}
        </Alert>
      )}

      {/* ローカルモード / リモートモード（Collapseでアニメーション切替） */}
      <Box>
        <Collapse in={importMode === 'local'} timeout={150} unmountOnExit>
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

        <Collapse in={importMode === 'remote'} timeout={150} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <RemoteSelect
              value={remoteName}
              onChange={handleRemoteChange}
              action={
                <ActionButton variant="confirm" label={t('share.connect')}
                  icon={loadingBranches ? <CircularProgress size={16} /> : <SyncIcon />}
                  onClick={handleLoadBranches} disabled={loadingBranches || !remoteName} size="small" />
              }
            />

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
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <ActionButton variant="confirm" label={t('share.mergeButton')}
          icon={merging ? <CircularProgress size={16} /> : (importMode === 'local' ? <MergeIcon /> : <CloudDownloadIcon />)}
          onClick={handleMerge} disabled={isMergeDisabled} />
      </Box>

      {/* 認証（リモートからの取り込み時のみ表示） */}
      <Collapse in={importMode === 'remote'} timeout={150} unmountOnExit>
        <AuthAccordion onChange={setAuthInfo} save={save} onSaveChange={setSave} />
      </Collapse>
    </Box>
  );
}

/**
 * DiffView は unified patch 文字列を行頭記号で色付けして表示する。
 * + 行（ローカルのみ）=緑、- 行（リモート/取込元のみ）=赤、@@ ヘッダ=淡色。
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
        return <div key={i} style={{ color }}>{line || ' '}</div>;
      })}
    </Box>
  );
}

export default ImportPanel;
