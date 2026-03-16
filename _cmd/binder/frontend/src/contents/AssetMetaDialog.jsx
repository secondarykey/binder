import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormLabel, Grid, InputAdornment, TextField,
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

  const handleDelete = () => {
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

  return (
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
                startAdornment: <InputAdornment position="start"><FormLabel>/assets/</FormLabel></InputAdornment>,
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
  );
}

export default AssetMetaDialog;
