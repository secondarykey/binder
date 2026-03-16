import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, Grid, InputAdornment, TextField,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import { EditDiagram, GetDiagram, RemoveDiagram } from "../../bindings/binder/api/app";
import { copyClipboard } from "../App";
import { EventContext } from "../Event";

/**
 * ダイアグラムのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function DiagramMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail("");

    GetDiagram(id).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setParentId(data.parentId);
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id]);

  const handleSave = () => {
    if (!name) { evt.showWarningMessage("name is required"); return; }
    if (!alias) { evt.showWarningMessage("alias is required"); return; }

    EditDiagram({ id, parentId, name, detail, alias }).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Update Diagram.");
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDelete = () => setConfirmDelete(true);

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveDiagram(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Remove Diagram.");
      onClose();
      nav("/editor/note/" + parentId);
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
      <DialogTitle>Edit Diagram</DialogTitle>
      <DialogContent>
        <Grid className="formGrid" style={{ margin: "8px 0" }}>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField size="small" value={id ?? ""} className="linkBtn" onClick={handleCopyId}
              InputProps={{ startAdornment: (<InputAdornment position="start"><ContentCopy /></InputAdornment>) }} />
          </FormControl>

          <FormControl>
            <FormLabel>Alias</FormLabel>
            <TextField
              size="small"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><FormLabel>/images/</FormLabel></InputAdornment>,
                endAdornment: <InputAdornment position="end"><FormLabel>.svg</FormLabel></InputAdornment>,
              }} />
          </FormControl>

          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
          </FormControl>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDelete} color="error">Delete</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>

    {/* 削除確認ダイアログ */}
    <Dialog
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>ダイアグラムの削除</DialogTitle>
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

export default DiagramMetaDialog;
