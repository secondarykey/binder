import {
  Button, Dialog, DialogActions, DialogContentText, DialogTitle,
} from "@mui/material";

/**
 * 確認ダイアログ（削除確認などに使用）
 * @param {{ open: boolean, title: string, message: string, onCancel: () => void, onConfirm: () => void }} props
 */
function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        {message}
      </DialogContentText>
      <DialogActions>
        <Button onClick={onCancel}>キャンセル</Button>
        <Button color="error" onClick={onConfirm}>削除</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
