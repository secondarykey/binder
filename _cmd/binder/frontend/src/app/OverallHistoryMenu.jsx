import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemText,
  Typography, CircularProgress, Box, Button, Tooltip,
  Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestoreIcon from '@mui/icons-material/Restore';

import { Events, Window } from '@wailsio/runtime';

import { GetOverallHistory, GetModifiedIds, RestoreToCommit } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

/**
 * 全体履歴 コミット一覧
 */
function OverallHistoryMenu() {

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

  // 初回読み込み
  useEffect(() => {
    setEntries([]);
    setOffset(0);
    setHasMore(false);
    setLoading(true);
    GetOverallHistory(PAGE_SIZE, 0).then((page) => {
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
    GetOverallHistory(PAGE_SIZE, offset).then((page) => {
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

    GetModifiedIds().then((ids) => {
      if ((ids ?? []).length > 0) {
        setConfirmOpen(true);
      } else {
        doRestore(entry.hash);
      }
    }).catch(() => {
      doRestore(entry.hash);
    });
  };

  const doRestore = (targetHash) => {
    RestoreToCommit(targetHash).then((result) => {
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
    </>
  );
}

export default OverallHistoryMenu;
