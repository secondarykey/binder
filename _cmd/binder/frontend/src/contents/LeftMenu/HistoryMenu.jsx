import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';

import { List, ListSubheader, ListItemButton, ListItemText, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';

import { GetHistory } from '../../../bindings/binder/api/app';

import { EventContext } from '../../Event';

/**
 * 履歴一覧
 * @param {{ typ: string, id: string }} props
 */
function HistoryMenu({ typ, id }) {

  const evt = useContext(EventContext);
  const { hash } = useParams();
  const nav = useNavigate();

  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!typ || !id) return;

    GetHistory(typ, id).then((list) => {
      setEntries(list ?? []);
    }).catch((err) => {
      evt.showErrorMessage(err);
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

  return (
    <List dense disablePadding className="treeText" sx={{ overflowY: 'auto', overflowX: 'hidden' }}>

      <ListSubheader disableSticky sx={{
        lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5,
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', opacity: 0.6,
        backgroundColor: '#222222', color: 'inherit',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <HistoryIcon sx={{ fontSize: '0.9rem' }} />
        Commits
      </ListSubheader>

      {entries.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', pl: 2, py: 1, opacity: 0.5 }}>
          No history found
        </Typography>
      )}

      {entries.map((entry) => (
        <ListItemButton key={entry.hash}
          selected={entry.hash === hash}
          sx={{
            pl: 2, py: 0.5, borderRadius: '2px',
            '&.Mui-selected': { backgroundColor: '#2a3f6f' },
            '&.Mui-selected:hover': { backgroundColor: '#2a3f6f' },
          }}
          onClick={() => handleClick(entry)}>
          <ListItemText
            primary={entry.message.split('\n')[0]}
            secondary={formatDate(entry.when)}
            primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }}
            secondaryTypographyProps={{ noWrap: true, fontSize: '0.75rem', color: '#888' }}
          />
        </ListItemButton>
      ))}

    </List>
  );
}

export default HistoryMenu;
