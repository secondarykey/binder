import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, Grid, IconButton, InputAdornment, TextField, Typography,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import { EditAsset, GetAsset, RemoveAsset } from "../../bindings/binder/api/app";
import { copyClipboard } from "../App";
import { EventContext } from "../Event";

/**
 * アセットのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function AssetMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");
  const [binary, setBinary] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail(""); setBinary(false);

    GetAsset(id).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setBinary(data.binary);
      setParentId(data.parentId);
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id]);

  const handleSave = () => {
    EditAsset({ id, parentId, name, alias, detail, binary }, "").then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Update Assets.");
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDelete = () => setConfirmDelete(true);

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveAsset(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Remove Assets.");
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
      <DialogTitle>Edit Assets</DialogTitle>
      <DialogContent>
        <Grid className="formGrid" style={{ margin: "8px 0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
              ID: {id}
            </Typography>
            <IconButton size="small" onClick={handleCopyId} title="Copy ID">
              <ContentCopy fontSize="small" />
            </IconButton>
          </Box>

          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
          </FormControl>

          <FormControl>
            <FormLabel>Alias</FormLabel>
            <TextField
              size="small"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><FormLabel>/assets/</FormLabel></InputAdornment>,
              }} />
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
      <DialogTitle>アセットの削除</DialogTitle>
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

export default AssetMetaDialog;
