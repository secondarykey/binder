import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemText, ListItemIcon,
  Typography, CircularProgress, Box, Chip, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CodeIcon from '@mui/icons-material/Code';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import PublicIcon from '@mui/icons-material/Public';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

import { GetCommitFiles, GetCommitFilesByPath } from '../../bindings/binder/api/app';
import { OpenHistoryWindow } from '../../bindings/main/window';

import { EventContext } from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';

const typeOrder = ['note', 'diagram', 'asset', 'template', 'database', 'publish', 'other'];

// ファイル履歴ウィンドウを呼び出せるカテゴリ
const clickableTypes = new Set(['note', 'diagram', 'asset', 'template']);

const typeIcons = {
  note:     <TextSnippetIcon fontSize="small" />,
  diagram:  <CodeIcon fontSize="small" />,
  asset:    <AttachFileIcon fontSize="small" />,
  template: <FolderIcon fontSize="small" />,
  database: <StorageIcon fontSize="small" />,
  publish:  <PublicIcon fontSize="small" />,
  other:    <InsertDriveFileIcon fontSize="small" />,
};

const actionColors = {
  added:    { bg: 'rgba(46, 160, 67, 0.15)', color: '#3fb950' },
  modified: { bg: 'rgba(210, 153, 34, 0.15)', color: '#d29922' },
  deleted:  { bg: 'rgba(248, 81, 73, 0.15)',  color: '#f85149' },
};

/**
 * 全体履歴 コミット詳細（変更ファイル一覧）
 * @param {{ binderPath?: string, hash?: string, onBack?: () => void }} props
 *   - hash が指定された場合はそちらを優先（モーダル統合用）
 *   - 未指定の場合は react-router の useParams から取得（OverallHistoryApp ウィンドウ用）
 *   - onBack が指定された場合は先頭に戻るボタンを表示する
 */
function OverallHistoryDetail({ binderPath, hash: hashProp, onBack }) {

  const { hash: routerHash } = useParams();
  const hash = hashProp !== undefined ? hashProp : routerHash;
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hash) return;
    setLoading(true);
    const fetchFiles = binderPath
      ? GetCommitFilesByPath(binderPath, hash)
      : GetCommitFiles(hash);
    fetchFiles.then((result) => {
      setFiles(result ?? []);
    }).catch((err) => {
      evt.showErrorMessage(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [hash]);

  const isClickable = (file) => clickableTypes.has(file.typ) && file.action !== 'deleted';

  const handleFileClick = (file) => {
    if (!isClickable(file)) return;
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
    database: t('overallHistory.database'),
    publish:  t('overallHistory.publish'),
    other:    t('overallHistory.other'),
  };

  return (
    <Box sx={{ p: 1 }}>

      {/** 戻るボタン（onBack が指定された場合のみ表示） */}
      {onBack && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <IconButton size="small" onClick={onBack} title={t('common.back')}
            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.75rem' }}>
            {hash}
          </Typography>
        </Box>
      )}

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
                cursor: isClickable(file) ? 'pointer' : 'default',
                opacity: file.action === 'deleted' ? 0.6 : 1,
              }}
              onClick={() => handleFileClick(file)}
              disabled={!isClickable(file)}
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
