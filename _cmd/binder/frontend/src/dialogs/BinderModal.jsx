import Binder from './Binder';
import ModalWrapper from './components/ModalWrapper';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * バインダー編集モーダル
 */
function BinderModal({ open, onClose }) {
  const {t} = useTranslation();
  return (
    <ModalWrapper open={open} onClose={onClose} title={t("binder.editTitle")}>
      <Binder isModal />
    </ModalWrapper>
  );
}

export default BinderModal;
