import { useRef, useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * ファイルタブバー
 * タブ表示 + 未保存マーク + 閉じるボタン
 */
function TabBar({ tabs, activeTabId, onSelect, onClose }) {
  const scrollRef = useRef(null);

  // アクティブタブが変わったら表示範囲にスクロール
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [activeTabId]);

  // ホイールで横スクロール
  const handleWheel = (e) => {
    if (scrollRef.current && e.deltaY !== 0) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-primary)',
      minHeight: '34px',
      flexShrink: 0,
    }}>
      {/* タブ一覧（横スクロール） */}
      <Box
        ref={scrollRef}
        onWheel={handleWheel}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          '&::-webkit-scrollbar': { height: '2px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'var(--border-primary)', borderRadius: '1px' },
        }}
      >
        {tabs.map(tab => {
          const isDirty = tab.content !== tab.savedContent;
          const isActive = tab.id === activeTabId;
          return (
            <Box
              key={tab.id}
              data-active={isActive ? 'true' : undefined}
              onClick={() => onSelect(tab.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                cursor: 'pointer',
                fontSize: '12px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-app)' : 'transparent',
                borderRight: '1px solid var(--border-primary)',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                maxWidth: '180px',
                '&:hover': { backgroundColor: isActive ? 'var(--bg-app)' : 'var(--bg-elevated)' },
              }}
            >
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {isDirty ? '● ' : ''}{tab.filename}
              </span>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                sx={{
                  color: 'var(--text-muted)',
                  p: 0.25,
                  flexShrink: 0,
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

    </Box>
  );
}

export default TabBar;
