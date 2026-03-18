import { useState, useEffect } from 'react';

import { Dialog, Toolbar, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ModifiedMenu from '../contents/LeftMenu/ModifiedMenu';
import Commit from '../contents/Commit';
import Patch from '../contents/Patch';

import '../assets/CommitApp.css';

/**
 * コミットモーダル
 * 変更ファイル一覧（左）とコミットフォーム/差分表示（右）をモーダルで表示
 * Router を使わず内部 state でナビゲーションを管理
 */
function CommitModal({ open, onClose }) {

  const [modalState, setModalState] = useState({
    view: 'commit',
    date: new Date().toISOString(),
    currentType: undefined,
    currentId: undefined,
  });

  // モーダルが開くたびにリセットして変更一覧を再取得
  useEffect(() => {
    if (open) {
      setModalState({
        view: 'commit',
        date: new Date().toISOString(),
        currentType: undefined,
        currentId: undefined,
      });
    }
  }, [open]);

  // ModifiedMenu からの疑似ナビゲーション
  // "/status/modified/:date" → コミットビュー
  // "/status/modified/:type/:id" → 差分ビュー
  const handleNavigate = (path) => {
    const suffix = path.replace('/status/modified/', '');
    const parts = suffix.split('/');
    if (parts.length === 1) {
      setModalState({ view: 'commit', date: parts[0], currentType: undefined, currentId: undefined });
    } else if (parts.length === 2) {
      setModalState((prev) => ({ ...prev, view: 'patch', currentType: parts[0], currentId: parts[1] }));
    }
  };

  const handleBack = () => {
    setModalState({ view: 'commit', date: new Date().toISOString(), currentType: undefined, currentId: undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '900px',
          height: '600px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
        }
      }}
    >
      <Toolbar id="commitTitle" className="binderTitle">
        <Typography variant="body1" sx={{ flex: 1 }}>Commit</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      <div id="commitArea">

        <div id="commitLeft">
          <ModifiedMenu
            date={modalState.date}
            currentId={modalState.currentId}
            onNavigate={handleNavigate}
          />
        </div>

        <div id="commitRight">
          {modalState.view === 'commit' ? (
            <div id="commitForm">
              <Commit date={modalState.date} />
            </div>
          ) : (
            <div id="patchView">
              <div id="patchBack">
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon fontSize="small" />}
                  onClick={handleBack}
                  sx={{ color: 'var(--text-muted)', textTransform: 'none' }}
                >
                  コメントに戻る
                </Button>
              </div>
              <div id="patchArea">
                <Patch type={modalState.currentType} currentId={modalState.currentId} />
              </div>
            </div>
          )}
        </div>

      </div>
    </Dialog>
  );
}

export default CommitModal;
