import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import { FormControl, FormLabel, InputAdornment, TextField } from "@mui/material";

import { EditAsset, GetAsset, RemoveAsset } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";

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

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveAsset(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Remove Assets.");
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => evt.showErrorMessage(err));
  };

  return (<>
    <MetaDialog
      open={open} onClose={onClose} title="Edit Assets"
      id={id} onSave={handleSave} onDelete={() => setConfirmDelete(true)}
    >
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
    </MetaDialog>

    <ConfirmDialog
      open={confirmDelete}
      title="アセットの削除"
      message={`「${name}」を削除しますか？`}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={handleDeleteConfirm}
    />
  </>);
}

export default AssetMetaDialog;
