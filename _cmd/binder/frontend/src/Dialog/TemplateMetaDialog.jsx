import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, Grid, IconButton, TextField, Typography,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import { EditTemplate, GetTemplate, RemoveTemplate } from "../../bindings/binder/api/app";
import { copyClipboard } from "../App";
import { EventContext } from "../Event";

/**
 * テンプレートのメタデータ編集ダイアログ
 * id が空文字の場合は新規作成モード、非空の場合は編集モード
 * @param {{ open: boolean, id: string, type: string, onClose: () => void }} props
 */
function TemplateMetaDialog({ open, id, type, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();

  const isCreate = !id;

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [resolvedType, setResolvedType] = useState(type ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(""); setDetail("");

    if (isCreate) {
      setResolvedType(type ?? "");
      return;
    }

    GetTemplate(id).then((data) => {
      setName(data.name);
      setDetail(data.detail);
      setResolvedType(data.type);
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id, type]);

  const handleSave = () => {
    if (!name) { evt.showWarningMessage("name is required"); return; }

    EditTemplate({ id: id ?? "", name, detail, type: resolvedType }).then((resp) => {
      evt.refreshTree();
      evt.showSuccessMessage(isCreate ? "Create Template." : "Update Template.");
      onClose();
      if (isCreate) {
        nav("/editor/template/" + resp.id);
      }
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDelete = () => setConfirmDelete(true);

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveTemplate(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Remove Template.");
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleCopyId = () => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  };

  return (<>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>{isCreate ? "Create Template" : "Edit Template"}</DialogTitle>
      <DialogContent>
        <Grid className="formGrid" style={{ margin: "8px 0" }}>
          {!isCreate && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" sx={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                ID: {id}
              </Typography>
              <IconButton size="small" onClick={handleCopyId} title="Copy ID">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Box>
          )}

          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
          </FormControl>

          <FormControl>
            <FormLabel>Type</FormLabel>
            <TextField size="small" value={resolvedType} slotProps={{ input: { readOnly: true } }} />
          </FormControl>
        </Grid>
      </DialogContent>
      <DialogActions>
        {!isCreate && <Button onClick={handleDelete} color="error">Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">{isCreate ? "Create" : "Save"}</Button>
      </DialogActions>
    </Dialog>

    {/* 削除確認ダイアログ */}
    <Dialog
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>テンプレートの削除</DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        「{name}」を削除しますか？
      </DialogContentText>
      <DialogActions>
        <Button onClick={() => setConfirmDelete(false)}>キャンセル</Button>
        <Button color="error" onClick={handleDeleteConfirm}>削除</Button>
      </DialogActions>
    </Dialog>
  </>);
}

export default TemplateMetaDialog;
