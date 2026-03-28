import { useState, useEffect } from 'react';

import UnpublishedMenu from './UnpublishedMenu';
import GenerateForm from './GenerateForm';
import ModalWrapper from './components/ModalWrapper';

import '../assets/CommitApp.css';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * 未公開一覧モーダル
 * CommitModal と同じ構成で、Generate を行っていないファイルの一覧を表示し、
 * 選択したファイルをまとめて Generate できる。
 */
function PublishModal({ open, template, onClose }) {
  const {t} = useTranslation();

  const [date, setDate] = useState(new Date().toISOString());

  // モーダルが開くたびにリセットして未公開一覧を再取得
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString());
    }
  }, [open]);

  const title = template ? t("template.batchPublishTitle") : t("publishModal.title");

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={title}
      width="900px" height="600px" maxWidth="90vw" maxHeight="85vh"
    >
      <div id="commitArea">
        <div id="commitLeft">
          <UnpublishedMenu date={date} template={template} onClose={onClose} />
        </div>
        <div id="commitRight">
          <div id="commitForm">
            <GenerateForm date={date} template={template} />
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}

export default PublishModal;
