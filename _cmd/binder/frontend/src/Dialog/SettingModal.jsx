import Setting from '../contents/Setting';
import ModalWrapper from './components/ModalWrapper';

/**
 * 設定モーダル
 */
function SettingModal({ open, onClose }) {
  return (
    <ModalWrapper open={open} onClose={onClose} title="Setting">
      <Setting isModal />
    </ModalWrapper>
  );
}

export default SettingModal;
