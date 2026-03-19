import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';

import { List, ListSubheader, ListItemButton, ListItemText, Typography, CircularProgress, Box, Button } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { GetHistory } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

/**
 * 履歴一覧
 * @param {{ typ: string, id: string }} props
 */
function HistoryMenu({ typ, id }) {

  const evt = useContext(EventContext);
  const { hash } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation();

  const [entries, setEntries] = useState([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!typ || !id) return;

    setLoading(true);
    setDisplayCount(PAGE_SIZE);
    GetHistory(typ, id).then((list) => {
      setEntries(list ?? []);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [typ, id]);

  const handleClick = (entry) => {
    nav('/history/diff/' + entry.hash);
  };

  const formatDate = (when) => {
    try {
      const d = new Date(when);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return when;
    }
  };

  const visibleEntries = entries.slice(0, displayCount);
  const hasMore = entries.length > displayCount;

  return (
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

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} thickness={4} sx={{ color: 'var(--text-disabled)' }} />
        </Box>
      )}

      {!loading && entries.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', pl: 2, py: 1, opacity: 0.5 }}>
          No history found
        </Typography>
      )}

      {visibleEntries.map((entry) => (
        <ListItemButton key={entry.hash}
          selected={entry.hash === hash}
          sx={{
            pl: 2, py: 0.5, borderRadius: '2px',
            '&.Mui-selected': { backgroundColor: 'var(--selected-bg)' },
            '&.Mui-selected:hover': { backgroundColor: 'var(--selected-bg)' },
          }}
          onClick={() => handleClick(entry)}>
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
      ))}

      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<ExpandMoreIcon fontSize="small" />}
            onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
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
  );
}

export default HistoryMenu;
