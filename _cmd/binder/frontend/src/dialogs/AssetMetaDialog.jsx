import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Accordion, AccordionDetails, AccordionSummary,
  FormControl, FormLabel, InputAdornment, TextField, Typography,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";

import { EditAsset, GetAsset, RemoveAsset } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import PublishDateField from "./components/PublishDateField";
import "../language";
import { useTranslation } from 'react-i18next';

const ZERO_TIME = "0001-01-01T00:00:00Z";
const isZeroTime = (v) => !v || (typeof v === 'string' && v.startsWith('0001-'));

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
  const [isPrivate, setIsPrivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publish, setPublish] = useState(null);
  const [republish, setRepublish] = useState(null);

  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail(""); setBinary(false); setMime(""); setIsPrivate(false);
    setPublish(null); setRepublish(null);

    GetAsset(id).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setBinary(data.binary);
      setMime(data.mime || "");
      setIsPrivate(data.private);
      setParentId(data.parentId);
      setPublish(isZeroTime(data.publish) ? null : new Date(data.publish));
      setRepublish(isZeroTime(data.republish) ? null : new Date(data.republish));
    }).catch((err) => evt.showErrorMessage(err));
  }, [open, id]);

  const handleSave = () => {
    EditAsset({ id, parentId, name, alias, detail, binary, mime, private: isPrivate, publish: publish || ZERO_TIME, republish: republish || ZERO_TIME }, "").then(() => {
      evt.markModified(id);
      evt.refreshTree();
      evt.showSuccessMessage(t("asset.updateSuccess"));
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
        <FormLabel>{t("common.mime")}</FormLabel>
        <TextField size="small" value={mime} onChange={(e) => setMime(e.target.value)} />
      </FormControl>

      <Accordion disableGutters elevation={0} sx={{ mt: 1, backgroundColor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0, minHeight: "auto", "& .MuiAccordionSummary-content": { my: 0.5 } }}>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>{t("meta.webPublish")}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0, display: "flex", flexDirection: "column", gap: 1 }}>
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
          <PublishDateField
            label={t("meta.publishDate")}
            value={publish}
            onReset={() => setPublish(new Date())}
            onClear={() => setPublish(null)}
          />
          <PublishDateField
            label={t("meta.republishDate")}
            value={republish}
            onReset={() => setRepublish(new Date())}
            onClear={() => setRepublish(null)}
          />
        </AccordionDetails>
      </Accordion>
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
