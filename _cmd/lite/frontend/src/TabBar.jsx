import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

/**
 * ファイルタブバー
 * タブ表示 + 未保存マーク + 閉じるボタン + ファイルを開くボタン
 */
function TabBar({ tabs, activeTabId, onSelect, onClose, onOpen, onNew }) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-primary)',
      minHeight: '34px',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* タブ一覧 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { height: 0 } }}>
        {tabs.map(tab => {
          const isDirty = tab.content !== tab.savedContent;
          const isActive = tab.id === activeTabId;
          return (
            <Box
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                cursor: 'pointer',
                fontSize: '12px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-app)' : 'transparent',
                borderRight: '1px solid var(--border-primary)',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                minWidth: 0,
                '&:hover': { backgroundColor: isActive ? 'var(--bg-app)' : 'var(--bg-elevated)' },
              }}
            >
              <span>{isDirty ? '● ' : ''}{tab.filename}</span>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                sx={{
                  color: 'var(--text-muted)',
                  p: 0.25,
                  '& svg': { fontSize: '14px' },
                  '&:hover': { color: 'var(--text-primary)' },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          );
        })}
      </Box>

      {/* 新規・開くボタン */}
      <Box sx={{ display: 'flex', flexShrink: 0, px: 0.5 }}>
        <IconButton size="small" onClick={onNew} sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}>
          <AddIcon sx={{ fontSize: '18px' }} />
        </IconButton>
        <IconButton size="small" onClick={onOpen} sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}>
          <FolderOpenIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default TabBar;
