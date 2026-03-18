import Binder from '../contents/Binder';
import ModalWrapper from './components/ModalWrapper';

/**
 * バインダー編集モーダル
 */
function BinderModal({ open, onClose }) {
  return (
    <ModalWrapper open={open} onClose={onClose} title="Edit Binder">
      <Binder isModal />
    </ModalWrapper>
  );
}

export default BinderModal;
