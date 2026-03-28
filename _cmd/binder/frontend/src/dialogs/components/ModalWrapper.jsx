import { useRef, useEffect, useCallback } from 'react';
import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * フルスクリーンモーダルのラッパー
 * Toolbar（タイトル+閉じるボタン）+ children のレイアウトを共通化
 * Toolbarをドラッグハンドルとしてモーダルを移動可能
 * @param {{ open: boolean, onClose: () => void, title: string, width?: string, height?: string, maxWidth?: string, maxHeight?: string, children: React.ReactNode }} props
 */
function ModalWrapper({ open, onClose, title, width = "1000px", height = "75vh", maxWidth, maxHeight, children }) {
  const paperRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    if (open) {
      posRef.current = { x: 0, y: 0 };
    }
  }, [open]);

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

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose();
      }}
      maxWidth={false}
      PaperProps={{
        ref: paperRef,
        sx: {
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          width,
          height,
          maxWidth: maxWidth || undefined,
          maxHeight: maxHeight || height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
        }
      }}
    >
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
        <Typography variant="body1" sx={{ flex: 1 }}>{title}</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </Dialog>
  );
}

export default ModalWrapper;
