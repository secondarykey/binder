import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemText,
  Typography, CircularProgress, Box, Button, Tooltip,
  Menu, MenuItem, ListItemIcon, TextField,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestoreIcon from '@mui/icons-material/Restore';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

import { Events, Window } from '@wailsio/runtime';

import { GetOverallHistory, GetOverallHistoryByPath, GetModifiedIds, RestoreToCommit, RestoreToCommitByPath, GetCleanupInfo, SquashHistory } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

/**
 * 全体履歴 コミット一覧
 * @param {{ binderPath?: string }} props binderPath が指定されていれば ByPath API を使用
 */
function OverallHistoryMenu({ binderPath }) {

  const evt = useContext(EventContext);
  const { hash } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation();

  const [entries, setEntries] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // コンテキストメニュー用
  const [ctxMenu, setCtxMenu] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreHash, setRestoreHash] = useState(null);

  // クリーンアップダイアログ用
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupDate, setCleanupDate] = useState('');
  const [cleanupInfo, setCleanupInfo] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // 初回読み込み
  useEffect(() => {
    setEntries([]);
    setOffset(0);
    setHasMore(false);
    setLoading(true);
    const fetchHistory = binderPath
      ? GetOverallHistoryByPath(binderPath, PAGE_SIZE, 0)
      : GetOverallHistory(PAGE_SIZE, 0);
    fetchHistory.then((page) => {
      setEntries(page?.entries ?? []);
      setHasMore(page?.hasMore ?? false);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  // ページ追加読み込み
  useEffect(() => {
    if (offset === 0) return;
    setLoading(true);
    const fetchMore = binderPath
      ? GetOverallHistoryByPath(binderPath, PAGE_SIZE, offset)
      : GetOverallHistory(PAGE_SIZE, offset);
    fetchMore.then((page) => {
      setEntries(prev => [...prev, ...(page?.entries ?? [])]);
      setHasMore(page?.hasMore ?? false);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [offset]);

  const handleClick = (entry) => {
    nav('/overall/detail/' + entry.hash);
  };

  const handleContextMenu = (e, entry) => {
    e.preventDefault();
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY, entry });
  };

  const handleCtxClose = () => setCtxMenu(null);

  // コンテキストメニューから復元を開始
  const handleCtxRestore = () => {
    const entry = ctxMenu?.entry;
    handleCtxClose();
    if (!entry) return;
    setRestoreHash(entry.hash);

    if (binderPath) {
      // ByPath モード: 未コミットチェック不要（バインダー未オープン）
      setConfirmOpen(true);
    } else {
      GetModifiedIds().then((ids) => {
        if ((ids ?? []).length > 0) {
          setConfirmOpen(true);
        } else {
          doRestore(entry.hash);
        }
      }).catch(() => {
        doRestore(entry.hash);
      });
    }
  };

  const doRestore = (targetHash) => {
    const restoreCall = binderPath
      ? RestoreToCommitByPath(binderPath, targetHash)
      : RestoreToCommit(targetHash);
    restoreCall.then((result) => {
      if (result?.status === 'success') {
        Events.Emit("binder:restored", { address: result.address });
        Window.Close();
      } else {
        evt.showErrorMessage(result?.message || 'Restore failed');
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const formatDate = (when) => {
    try {
      const d = new Date(when);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return when;
    }
  };

  // サイズを読みやすい形式にフォーマット
  const formatSize = (bytes) => {
    if (bytes == null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  };

  // --- クリーンアップ ---

  const handleOpenCleanup = () => {
    // デフォルト: 1ヶ月前
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const dateStr = d.toISOString().split('T')[0];
    setCleanupDate(dateStr);
    setCleanupInfo(null);
    setCleanupOpen(true);
    fetchCleanupInfo(dateStr);
  };

  const fetchCleanupInfo = (dateStr) => {
    if (!dateStr) return;
    setCleanupLoading(true);
    const rfc3339 = dateStr + 'T00:00:00Z';
    GetCleanupInfo(rfc3339).then((info) => {
      setCleanupInfo(info);
    }).catch((err) => {
      setCleanupInfo(null);
      evt.showErrorMessage(err);
    }).finally(() => {
      setCleanupLoading(false);
    });
  };

  const handleCleanupDateChange = (e) => {
    const val = e.target.value;
    setCleanupDate(val);
    fetchCleanupInfo(val);
  };

  const doSquashHistory = () => {
    if (!cleanupDate) return;
    setCleanupLoading(true);
    const rfc3339 = cleanupDate + 'T00:00:00Z';
    SquashHistory(rfc3339).then((result) => {
      if (result?.status === 'success') {
        const before = formatSize(result.beforeSize);
        const after = formatSize(result.afterSize);
        setCleanupOpen(false);
        evt.showSuccessMessage(t('overallHistory.cleanupComplete', { before, after }));
        setTimeout(() => {
          Events.Emit("binder:restored", { address: result.address });
          Window.Close();
        }, 2000);
      } else {
        evt.showErrorMessage(result?.message || 'Cleanup failed');
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setCleanupLoading(false);
    });
  };

  return (
    <>
    <List dense disablePadding className="treeText" sx={{ overflowY: 'auto', overflowX: 'hidden' }}>

      <ListSubheader disableSticky sx={{
        lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5,
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', opacity: 0.6,
        backgroundColor: 'var(--bg-overlay)', color: 'inherit',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <HistoryIcon sx={{ fontSize: '0.9rem' }} />
        Commits
      </ListSubheader>

      {loading && entries.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} thickness={4} sx={{ color: 'var(--text-disabled)' }} />
        </Box>
      )}

      {!loading && entries.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', pl: 2, py: 1, opacity: 0.5 }}>
          No history found
        </Typography>
      )}

      {entries.map((entry) => (
        <Tooltip
          key={entry.hash}
          title={<span style={{ whiteSpace: 'pre-wrap' }}>{entry.message.trim()}</span>}
          placement="right"
          enterDelay={600}
          arrow
        >
          <ListItemButton
            selected={entry.hash === hash}
            sx={{
              pl: 2, py: 0.5, borderRadius: '2px',
              '&.Mui-selected': { backgroundColor: 'var(--selected-bg)' },
              '&.Mui-selected:hover': { backgroundColor: 'var(--selected-bg)' },
            }}
            onClick={() => handleClick(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}>
            <ListItemText
              sx={{ my: 0 }}
              primary={entry.message.split('\n')[0]}
              secondary={
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{formatDate(entry.when)}</span>
                  <span style={{ fontFamily: 'monospace', flexShrink: 0, marginLeft: '8px' }}>
                    {entry.hash.slice(0, 7)}
                  </span>
                </span>
              }
              primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }}
              secondaryTypographyProps={{ component: 'span', fontSize: '0.75rem', color: 'var(--text-disabled)' }}
            />
          </ListItemButton>
        </Tooltip>
      ))}

      {loading && entries.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={20} thickness={4} sx={{ color: 'var(--text-disabled)' }} />
        </Box>
      )}

      {!loading && hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<ExpandMoreIcon fontSize="small" />}
            onClick={() => setOffset(prev => prev + PAGE_SIZE)}
            sx={{
              fontSize: '0.72rem', color: 'var(--text-disabled)', textTransform: 'none',
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            {t('history.loadMore')}
          </Button>
        </Box>
      )}

      {/* クリーンアップボタン（ByPath モードでは非表示） */}
      {!binderPath && !loading && entries.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, borderTop: '1px solid var(--border-color)' }}>
          <Button
            size="small"
            variant="text"
            startIcon={<CleaningServicesIcon fontSize="small" />}
            onClick={handleOpenCleanup}
            sx={{
              fontSize: '0.72rem', color: 'var(--text-disabled)', textTransform: 'none',
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            {t('overallHistory.cleanup')}
          </Button>
        </Box>
      )}

    </List>

    {/* 右クリックコンテキストメニュー */}
    <Menu
      open={ctxMenu !== null}
      onClose={handleCtxClose}
      anchorReference="anchorPosition"
      anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
      slotProps={{ paper: { sx: { backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)', minWidth: 180 } } }}
    >
      <MenuItem onClick={handleCtxRestore} dense sx={{ fontSize: '0.875rem' }}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <RestoreIcon fontSize="small" sx={{ color: 'var(--text-primary)' }} />
        </ListItemIcon>
        {t('overallHistory.restore')}
      </MenuItem>
    </Menu>

    {/* 未コミット変更がある場合の確認ダイアログ */}
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
      <DialogTitle>{t('overallHistory.restoreTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('overallHistory.restoreWarning')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
        <Button color="warning" onClick={() => { setConfirmOpen(false); doRestore(restoreHash); }}>
          {t('overallHistory.restore')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* クリーンアップ確認ダイアログ */}
    <Dialog open={cleanupOpen} onClose={() => setCleanupOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{t('overallHistory.cleanupTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('overallHistory.cleanupDesc')}
        </DialogContentText>

        <TextField
          type="date"
          label={t('overallHistory.cleanupDateLabel')}
          value={cleanupDate}
          onChange={handleCleanupDateChange}
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mb: 2 }}
        />

        {cleanupLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={20} thickness={4} />
          </Box>
        )}

        {cleanupInfo && !cleanupLoading && (
          <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: 'var(--bg-overlay)', fontSize: '0.875rem' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {t('overallHistory.cleanupStats', {
                total: cleanupInfo.totalCommits,
                squash: cleanupInfo.squashTarget,
                keep: cleanupInfo.keepTarget,
              })}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5, opacity: 0.7 }}>
              {t('overallHistory.cleanupCurrentSize', {
                size: formatSize(cleanupInfo.objectsSize),
              })}
            </Typography>
            {cleanupInfo.squashTarget > 0 && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1, fontSize: '0.8rem' }}>
                {t('overallHistory.cleanupWarning')}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCleanupOpen(false)}>{t('common.cancel')}</Button>
        <Button
          color="warning"
          onClick={doSquashHistory}
          disabled={cleanupLoading || !cleanupInfo || cleanupInfo.squashTarget === 0}
        >
          {t('overallHistory.cleanupConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

export default OverallHistoryMenu;
