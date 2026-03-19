import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import { FormControl, FormLabel, TextField } from "@mui/material";

import { EditTemplate, GetTemplate, RemoveTemplate } from "../../bindings/binder/api/app";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";

/**
 * テンプレートのメタデータ編集ダイアログ
 * id が空文字の場合は新規作成モード、非空の場合は編集モード
 * @param {{ open: boolean, id: string, type: string, onClose: () => void }} props
 */
function TemplateMetaDialog({ open, id, type, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

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
    if (!name) { evt.showWarningMessage(t("template.nameRequired")); return; }

    EditTemplate({ id: id ?? "", name, detail, type: resolvedType }).then((resp) => {
      evt.refreshTree();
      evt.showSuccessMessage(isCreate ? t("template.createSuccess") : t("template.updateSuccess"));
      onClose();
      if (isCreate) {
        nav("/editor/template/" + resp.id);
      }
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveTemplate(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage(t("template.removeSuccess"));
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  return (<>
    <MetaDialog
      open={open} onClose={onClose}
      title={isCreate ? t("template.createTitle") : t("template.editTitle")}
      id={id} showId={!isCreate}
      onSave={handleSave}
      onDelete={() => setConfirmDelete(true)} showDelete={!isCreate}
    >
      <FormControl>
        <FormLabel>{t("common.name")}</FormLabel>
        <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>{t("common.detail")}</FormLabel>
        <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
      </FormControl>

      <FormControl>
        <FormLabel>{t("template.type")}</FormLabel>
        <TextField size="small" value={resolvedType} slotProps={{ input: { readOnly: true } }} />
      </FormControl>
    </MetaDialog>

    <ConfirmDialog
      open={confirmDelete}
      title={t("template.deleteTitle")}
      message={t("template.deleteConfirm", { name })}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={handleDeleteConfirm}
    />
  </>);
}

export default TemplateMetaDialog;
