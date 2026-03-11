import { useEffect, useContext } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';

import { Toolbar, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Dialog } from '@mui/material';

import { EventContext } from './Event';
import ModifiedMenu from './contents/LeftMenu/ModifiedMenu';
import Commit from './contents/Commit';
import Patch from './contents/Patch';

import './assets/CommitApp.css';

/**
 * 差分表示 + コメントに戻るボタン（モーダル内用）
 */
function PatchView() {
  const nav = useNavigate();

  const handleBack = () => {
    nav("/status/modified/" + new Date().toISOString());
  };

  return (
    <div id="patchView">
      <div id="patchBack">
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={handleBack}
          sx={{ color: '#aaaaaa', textTransform: 'none' }}
        >
          コメントに戻る
        </Button>
      </div>
      <div id="patchArea">
        <Patch />
      </div>
    </div>
  );
}

/**
 * モーダル内コンテンツ（MemoryRouter 配下で動作）
 */
function CommitContent({ onClose }) {
  const nav = useNavigate();

  useEffect(() => {
    nav("/status/modified/" + new Date().toISOString());
  }, []);

  return (
    <>
      <Toolbar id="commitTitle" className="binderTitle">
        <Typography variant="body1" sx={{ flex: 1 }}>Commit</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      <div id="commitArea">
        <div id="commitLeft">
          <Routes>
            <Route path="/status/modified/:date" element={<ModifiedMenu />} />
            <Route path="/status/modified/:type/:currentId" element={<ModifiedMenu />} />
            <Route path="*" element={<ModifiedMenu />} />
          </Routes>
        </div>

        <div id="commitRight">
          <Routes>
            <Route path="/status/modified/:date" element={<div id="commitForm"><Commit /></div>} />
            <Route path="/status/modified/:type/:currentId" element={<PatchView />} />
            <Route path="*" element={<div id="commitForm"><Commit /></div>} />
          </Routes>
        </div>
      </div>
    </>
  );
}

/**
 * コミットモーダル
 * 変更ファイル一覧（左）とコミットフォーム/差分表示（右）をモーダルで表示
 */
function CommitModal({ open, onClose }) {
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
          backgroundColor: '#252525',
          color: '#f1f1f1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
        }
      }}
    >
      <MemoryRouter>
        <CommitContent onClose={onClose} />
      </MemoryRouter>
    </Dialog>
  );
}

export default CommitModal;
