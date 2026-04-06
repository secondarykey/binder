import Binder from './Binder';
import ModalWrapper from './components/ModalWrapper';
import "../language";
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
