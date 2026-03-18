import { useState, useEffect } from 'react';

import UnpublishedMenu from './UnpublishedMenu';
import GenerateForm from './GenerateForm';
import ModalWrapper from './components/ModalWrapper';

import '../assets/CommitApp.css';

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
    <ModalWrapper
      open={open} onClose={onClose} title="Unpublished Files"
      width="900px" height="600px" maxWidth="90vw" maxHeight="85vh"
    >
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
    </ModalWrapper>
  );
}

export default PublishModal;
