import { useState, useEffect } from 'react';

import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import UnpublishedMenu from './contents/LeftMenu/UnpublishedMenu';

import './assets/CommitApp.css';

/**
 * 未公開一覧モーダル
 * Generate を行っていないファイルの一覧を表示する
 */
function PublishModal({ open, onClose }) {

  const [date, setDate] = useState(new Date().toISOString());

  // モーダルが開くたびにリセットして未公開一覧を再取得
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString());
    }
  }, [open]);

  const handleNavigate = (path) => {
    // エディタへ遷移したらモーダルを閉じる
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '640px',
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
      <Toolbar id="commitTitle" className="binderTitle">
        <Typography variant="body1" sx={{ flex: 1 }}>Unpublished Files</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      <div id="commitArea">

        <div id="commitLeft">
          <UnpublishedMenu
            date={date}
            onNavigate={handleNavigate}
          />
        </div>

        <div id="commitRight">
          <div id="commitForm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ color: '#888', textAlign: 'center', px: 3 }}>
              ファイルをクリックするとエディタで開きます。
              <br /><br />
              エディタの Generate ボタンで公開できます。
            </Typography>
          </div>
        </div>

      </div>
    </Dialog>
  );
}

export default PublishModal;
