import { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ModifiedMenu from './ModifiedMenu';
import Commit from '../components/Commit';
import Patch from '../components/Patch';
import ModalWrapper from './components/ModalWrapper';

import '../assets/CommitApp.css';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * コミットモーダル
 * 変更ファイル一覧（左）とコミットフォーム/差分表示（右）をモーダルで表示
 * Router を使わず内部 state でナビゲーションを管理
 */
function CommitModal({ open, onClose }) {
  const {t} = useTranslation();

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
    <ModalWrapper
      open={open} onClose={onClose} title={t("commitModal.title")}
      width="900px" height="600px" maxWidth="90vw" maxHeight="85vh"
    >
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
                  {t("commitModal.backToComment")}
                </Button>
              </div>
              <div id="patchArea">
                <Patch type={modalState.currentType} currentId={modalState.currentId} />
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

export default CommitModal;
