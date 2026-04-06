import Setting from './Setting';
import ModalWrapper from './components/ModalWrapper';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * 設定モーダル
 */
function SettingModal({ open, onClose }) {
  const {t} = useTranslation();
  return (
    <ModalWrapper open={open} onClose={onClose} title={t("setting.title")}>
      <Setting isModal />
    </ModalWrapper>
  );
}

export default SettingModal;
