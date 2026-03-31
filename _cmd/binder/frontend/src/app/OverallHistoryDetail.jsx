import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemText, ListItemIcon,
  Typography, CircularProgress, Box, Chip,
} from '@mui/material';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CodeIcon from '@mui/icons-material/Code';
import FolderIcon from '@mui/icons-material/Folder';

import { GetCommitFiles } from '../../bindings/binder/api/app';
import { OpenHistoryWindow } from '../../bindings/main/window';

import { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const typeOrder = ['note', 'diagram', 'asset', 'template'];

const typeIcons = {
  note:     <TextSnippetIcon fontSize="small" />,
  diagram:  <CodeIcon fontSize="small" />,
  asset:    <AttachFileIcon fontSize="small" />,
  template: <FolderIcon fontSize="small" />,
};

const actionColors = {
  added:    { bg: 'rgba(46, 160, 67, 0.15)', color: '#3fb950' },
  modified: { bg: 'rgba(210, 153, 34, 0.15)', color: '#d29922' },
  deleted:  { bg: 'rgba(248, 81, 73, 0.15)',  color: '#f85149' },
};

/**
 * 全体履歴 コミット詳細（変更ファイル一覧）
 */
function OverallHistoryDetail() {

  const { hash } = useParams();
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hash) return;
    setLoading(true);
    GetCommitFiles(hash).then((result) => {
      setFiles(result ?? []);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [hash]);

  const handleFileClick = (file) => {
    if (file.action === 'deleted') return;
    OpenHistoryWindow(file.typ, file.id, file.name);
  };

  // タイプ別にグループ化
  const grouped = {};
  for (const file of files) {
    if (!grouped[file.typ]) grouped[file.typ] = [];
    grouped[file.typ].push(file);
  }

  const typeLabels = {
    note:     t('overallHistory.notes'),
    diagram:  t('overallHistory.diagrams'),
    asset:    t('overallHistory.assets'),
    template: t('overallHistory.templates'),
  };

  return (
    <Box sx={{ p: 1 }}>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} thickness={4} sx={{ color: 'var(--text-disabled)' }} />
        </Box>
      )}

      {!loading && files.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', pl: 1, py: 1, opacity: 0.5 }}>
          {t('overallHistory.noFiles')}
        </Typography>
      )}

      {!loading && typeOrder.filter(typ => grouped[typ]).map(typ => (
        <List key={typ} dense disablePadding className="treeText">
          <ListSubheader disableSticky sx={{
            lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5,
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', opacity: 0.6,
            backgroundColor: 'transparent', color: 'inherit',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            {typeIcons[typ]}
            {typeLabels[typ] || typ}
          </ListSubheader>

          {grouped[typ].map((file) => (
            <ListItemButton
              key={file.id}
              sx={{
                pl: 2, py: 0.3, borderRadius: '2px',
                cursor: file.action === 'deleted' ? 'default' : 'pointer',
                opacity: file.action === 'deleted' ? 0.6 : 1,
              }}
              onClick={() => handleFileClick(file)}
              disabled={file.action === 'deleted'}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'var(--text-muted)' }}>
                {typeIcons[file.typ]}
              </ListItemIcon>
              <ListItemText
                sx={{ my: 0 }}
                primary={file.name}
                primaryTypographyProps={{ noWrap: true, fontSize: '0.85rem' }}
              />
              <Chip
                label={t('overallHistory.' + file.action)}
                size="small"
                sx={{
                  height: 18, fontSize: '0.65rem', fontWeight: 600,
                  backgroundColor: actionColors[file.action]?.bg ?? 'transparent',
                  color: actionColors[file.action]?.color ?? 'inherit',
                  borderRadius: '4px',
                  ml: 1,
                }}
              />
            </ListItemButton>
          ))}
        </List>
      ))}

    </Box>
  );
}

export default OverallHistoryDetail;
