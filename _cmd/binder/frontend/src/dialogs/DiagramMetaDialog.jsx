import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import { FormControl, FormLabel, InputAdornment, MenuItem, Select, TextField } from "@mui/material";

import { EditDiagram, GetDiagram, GetHTMLTemplates, RemoveDiagram } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * ダイアグラムのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function DiagramMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [styleTemplate, setStyleTemplate] = useState("");
  const [diagramTemplates, setDiagramTemplates] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ダイアグラムテンプレート一覧（起動時に1回取得）
  useEffect(() => {
    GetHTMLTemplates().then((tmpls) => {
      setDiagramTemplates(tmpls.diagrams ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail(""); setIsPrivate(false); setStyleTemplate("");

    GetDiagram(id).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setIsPrivate(data.private);
      setParentId(data.parentId);
      setStyleTemplate(data.styleTemplate || "");
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id]);

  const handleSave = () => {
    if (!name) { evt.showWarningMessage(t("diagram.nameRequired")); return; }
    if (!alias) { evt.showWarningMessage(t("diagram.aliasRequired")); return; }

    EditDiagram({ id, parentId, name, detail, alias, private: isPrivate, styleTemplate }).then(() => {
      evt.markModified(id);
      evt.refreshTree();
      evt.showSuccessMessage(t("diagram.updateSuccess"));
      onClose();
    }).catch((err) => {
      if (typeof err === 'string' && err.includes("duplicate alias")) {
        evt.showWarningMessage(t("common.aliasDuplicate"));
      } else {
        evt.showErrorMessage(err);
      }
    });
  };

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveDiagram(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage(t("diagram.removeSuccess"));
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => evt.showErrorMessage(err));
  };

  return (<>
    <MetaDialog
      open={open} onClose={onClose} title={t("diagram.editTitle")}
      id={id} onSave={handleSave} onDelete={() => setConfirmDelete(true)}
      isPrivate={isPrivate} onPrivateChange={setIsPrivate}
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
        <FormLabel>{t("diagram.styleTemplate")}</FormLabel>
        <Select size="small" value={styleTemplate} onChange={(e) => setStyleTemplate(e.target.value)} displayEmpty>
          <MenuItem value="">{t("common.none")}</MenuItem>
          {diagramTemplates.map((tmpl) => <MenuItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>{t("common.alias")}</FormLabel>
        <TextField
          size="small"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><FormLabel>/images/</FormLabel></InputAdornment>,
            endAdornment: <InputAdornment position="end"><FormLabel>.svg</FormLabel></InputAdornment>,
          }} />
      </FormControl>
    </MetaDialog>

    <ConfirmDialog
      open={confirmDelete}
      title={t("diagram.deleteTitle")}
      message={t("diagram.deleteConfirm", { name })}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={handleDeleteConfirm}
    />
  </>);
}

export default DiagramMetaDialog;
