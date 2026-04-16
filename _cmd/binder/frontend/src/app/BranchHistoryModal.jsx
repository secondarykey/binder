import { useState, useRef, useCallback } from 'react';
import { Box, Dialog, IconButton, Toolbar, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import OverallHistoryMenu from './OverallHistoryMenu';
import OverallHistoryDetail from './OverallHistoryDetail';
import { BranchPanel } from '../dialogs/BranchModal';

import '../language';
import { useTranslation } from 'react-i18next';

/**
 * ブランチ管理 + 全体履歴の統合フルスクリーンモーダル
 * - 左ペイン: コミット一覧（全体履歴）
 * - 右ペイン: ブランチ管理（初期）/ コミット詳細（コミット選択時）
 * - メインウィンドウ内の Dialog として表示するため、背後の操作はブロックされる
 */
function BranchHistoryModal({ open, onClose }) {
  const { t } = useTranslation();
  const [selectedHash, setSelectedHash] = useState(null);

  const paperRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };

    const handleMouseMove = (ev) => {
      if (!dragRef.current.isDragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      posRef.current = { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy };
      if (paperRef.current) {
        paperRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
      }
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSelect = (hash) => {
    setSelectedHash(hash);
  };

  const handleClose = () => {
    setSelectedHash(null);
    posRef.current = { x: 0, y: 0 };
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        handleClose();
      }}
      maxWidth={false}
      PaperProps={{
        ref: paperRef,
        sx: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          width: '1000px',
          height: '680px',
          maxWidth: '92vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
        }
      }}
    >
      {/** タイトルバー（ドラッグハンドル） */}
      <Toolbar
        onMouseDown={handleMouseDown}
        sx={{
          minHeight: '40px !important',
          paddingLeft: '16px !important',
          paddingRight: '0px',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-titlebar)',
          flexShrink: 0,
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <Typography variant="body1" sx={{ flex: 1 }}>
          {t('branch.title')}
        </Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** メインエリア: 左=コミット一覧、右=ブランチ or コミット詳細 */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/** 左ペイン: 全体履歴コミット一覧 */}
        <Box sx={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: 'var(--bg-overlay)',
        }}>
          {open && (
            <OverallHistoryMenu
              binderPath=""
              selectedHash={selectedHash}
              onSelect={handleSelect}
              onClose={handleClose}
            />
          )}
        </Box>

        {/** 右ペイン: ブランチ管理（初期）/ コミット詳細（選択時） */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {selectedHash
            ? <OverallHistoryDetail binderPath="" hash={selectedHash}
                onBack={() => setSelectedHash(null)} />
            : open && <BranchPanel onClose={handleClose} />
          }
        </Box>

      </Box>
    </Dialog>
  );
}

export default BranchHistoryModal;
