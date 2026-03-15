import { useState, useEffect } from 'react';

import { Dialog, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import UnpublishedMenu from './contents/LeftMenu/UnpublishedMenu';
import GenerateForm from './contents/GenerateForm';

import './assets/CommitApp.css';

/**
 * 未公開一覧モーダル
 * CommitModal と同じ構成で、Generate を行っていないファイルの一覧を表示し、
 * 選択したファイルをまとめて Generate できる。
 */
function PublishModal({ open, onClose }) {

  const [date, setDate] = useState(new Date().toISOString());

  // モーダルが開くたびにリセットして未公開一覧を再取得
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString());
    }
  }, [open]);

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
        <Typography variant="body1" sx={{ flex: 1 }}>Unpublished Files</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      <div id="commitArea">

        <div id="commitLeft">
          <UnpublishedMenu date={date} />
        </div>

        <div id="commitRight">
          <div id="commitForm">
            <GenerateForm date={date} />
          </div>
        </div>

      </div>
    </Dialog>
  );
}

export default PublishModal;
