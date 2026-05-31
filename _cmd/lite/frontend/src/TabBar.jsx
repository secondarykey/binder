import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const SCROLL_AMOUNT = 150;

/**
 * ファイルタブバー
 * タブ表示 + 未保存マーク + 閉じるボタン
 * オーバーフロー時は左右スクロールボタンを表示
 */
function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // スクロール状態を更新
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // タブ数やウィンドウサイズ変更時にスクロール状態を再計算
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length, updateScrollState]);

  // アクティブタブが変わったら表示範囲にスクロール
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
    // スクロール後に状態を更新
    requestAnimationFrame(updateScrollState);
  }, [activeTabId, updateScrollState]);

  // ホイールで横スクロール
  const handleWheel = (e) => {
    if (scrollRef.current && e.deltaY !== 0) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
      requestAnimationFrame(updateScrollState);
    }
  };

  const scrollLeft = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
    setTimeout(updateScrollState, 200);
  };

  const scrollRight = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
    setTimeout(updateScrollState, 200);
  };

  const arrowSx = {
    color: 'var(--text-muted)',
    width: 24,
    height: 24,
    borderRadius: 0,
    flexShrink: 0,
    backgroundColor: 'var(--bg-elevated)',
    '&:hover': { color: 'var(--text-primary)', backgroundColor: 'var(--bg-overlay)' },
  };

  const leftArrowSx = { ...arrowSx, borderRight: '2px solid var(--border-primary)' };
  const rightArrowSx = { ...arrowSx, borderLeft: '2px solid var(--border-primary)' };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-primary)',
      minHeight: '34px',
      flexShrink: 0,
    }}>
      {/* 新規タブボタン（左固定） */}
      <IconButton
        size="small"
        onClick={onNew}
        sx={{
          color: 'var(--text-muted)',
          width: 28,
          height: 28,
          borderRadius: 0,
          flexShrink: 0,
          borderRight: '1px solid var(--border-primary)',
          '&:hover': { color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' },
        }}
      >
        <AddIcon sx={{ fontSize: '18px' }} />
      </IconButton>

      {/* 左スクロールボタン */}
      {canScrollLeft && (
        <IconButton size="small" onClick={scrollLeft} sx={leftArrowSx}>
          <ChevronLeftIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      )}

      {/* タブ一覧（横スクロール） */}
      <Box
        ref={scrollRef}
        onWheel={handleWheel}
        onScroll={updateScrollState}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',           // Firefox
          '&::-webkit-scrollbar': { display: 'none' },  // スクロールバー非表示（ボタンで操作）
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
                backgroundColor: isActive ? 'var(--bg-editor)' : 'transparent',
                borderRight: '1px solid var(--border-primary)',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                maxWidth: '180px',
                '&:hover': { backgroundColor: isActive ? 'var(--bg-editor)' : 'var(--bg-elevated)' },
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

      {/* 右スクロールボタン */}
      {canScrollRight && (
        <IconButton size="small" onClick={scrollRight} sx={rightArrowSx}>
          <ChevronRightIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      )}
    </Box>
  );
}

export default TabBar;
