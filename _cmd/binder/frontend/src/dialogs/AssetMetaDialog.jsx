import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import { FormControl, FormLabel, InputAdornment, TextField } from "@mui/material";

import { EditAsset, GetAsset, RemoveAsset } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * アセットのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function AssetMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");
  const [binary, setBinary] = useState(false);
  const [mime, setMime] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail(""); setBinary(false); setMime("");

    GetAsset(id).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setBinary(data.binary);
      setMime(data.mime || "");
      setParentId(data.parentId);
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id]);

  const handleSave = () => {
    EditAsset({ id, parentId, name, alias, detail, binary, mime }, "").then(() => {
      evt.markModified(id);
      evt.refreshTree();
      evt.showSuccessMessage(t("asset.updateSuccess"));
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveAsset(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage(t("asset.removeSuccess"));
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => evt.showErrorMessage(err));
  };

  return (<>
    <MetaDialog
      open={open} onClose={onClose} title={t("asset.editTitle")}
      id={id} onSave={handleSave} onDelete={() => setConfirmDelete(true)}
    >
      <FormControl>
        <FormLabel>{t("common.name")}</FormLabel>
        <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>{t("common.detail")}</FormLabel>
        <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline maxRows={4} />
      </FormControl>

      <FormControl>
        <FormLabel>{t("common.mime")}</FormLabel>
        <TextField size="small" value={mime} onChange={(e) => setMime(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>{t("common.alias")}</FormLabel>
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
      title={t("asset.deleteTitle")}
      message={t("asset.deleteConfirm", { name })}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={handleDeleteConfirm}
    />
  </>);
}

export default AssetMetaDialog;
