import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button,
  Container, FormControl, FormLabel, IconButton, InputAdornment,
  Select, TextField, MenuItem, Typography,
} from "@mui/material";
import { DeleteOutline, ExpandMore } from "@mui/icons-material";
import PublishDateField from "./components/PublishDateField";

import {
  GetNote, GetHTMLTemplates, GetNoteImageURL, DeleteNoteImage, UploadNoteImage,
  EditNote, RemoveNote,
} from "../../bindings/binder/api/app";
import { SelectFile } from "../../bindings/main/window";
import noImage from '../assets/images/noimage.png';
import { EventContext } from "../Event";
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import "../language";
import { useTranslation } from 'react-i18next';

// Go の time.Time ゼロ値 (0001-01-01T00:00:00Z) を表すセンチネル
const ZERO_TIME = "0001-01-01T00:00:00Z";
const isZeroTime = (v) => !v || (typeof v === 'string' && v.startsWith('0001-'));

/**
 * ノートのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function NoteMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [viewImage, setViewImage] = useState(noImage);
  const [hasImage, setHasImage] = useState(false);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detail, setDetail] = useState("");
  const [layout, setLayout] = useState("");
  const [content, setContent] = useState("");
  const [layouts, setLayouts] = useState([]);
  const [contents, setContents] = useState([]);
  const [publish, setPublish] = useState(null);
  const [republish, setRepublish] = useState(null);

  // テンプレート一覧（起動時に1回取得）
  useEffect(() => {
    GetHTMLTemplates().then((tmpls) => {
      setLayouts(tmpls.layouts);
      setContents(tmpls.contents);
    }).catch(() => {});
  }, []);

  // ダイアログが開くたびにデータ取得
  useEffect(() => {
    if (!open || !id) return;
    setName(""); setAlias(""); setDetail(""); setIsPrivate(false);
    setViewImage(noImage); setHasImage(false);
    setPublish(null); setRepublish(null);

    GetNote(id).then((note) => {
      setName(note.name);
      setAlias(note.alias);
      setDetail(note.detail);
      setIsPrivate(note.private);
      setParentId(note.parentId);
      setLayout(note.layoutTemplate);
      setContent(note.contentTemplate);
      setPublish(isZeroTime(note.publish) ? null : new Date(note.publish));
      setRepublish(isZeroTime(note.republish) ? null : new Date(note.republish));
    }).catch((err) => evt.showErrorMessage(err));

    GetNoteImageURL(id).then((url) => {
      setViewImage(url || noImage);
      setHasImage(!!url);
    }).catch(() => { setViewImage(noImage); setHasImage(false); });
  }, [open, id]);

  const handleSave = () => {
    if (!name) { evt.showWarningMessage(t("note.nameRequired")); return; }
    if (!layout || !content) { evt.showWarningMessage(t("note.chooseTemplate")); return; }
    if (!alias && id !== "index") { evt.showWarningMessage(t("note.aliasRequired")); return; }

    const note = {
      id, parentId, name, alias, detail, private: isPrivate,
      layoutTemplate: layout, contentTemplate: content,
      publish: publish || ZERO_TIME,
      republish: republish || ZERO_TIME,
    };
    EditNote(note, "").then(() => {
      evt.markModified(id);
      evt.refreshTree();
      evt.showSuccessMessage(t("note.updateSuccess"));
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
    RemoveNote(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage(t("note.removeSuccess"));
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => evt.showErrorMessage(err));
  };

  const selectFile = () => {
    SelectFile("Page Image File", "*.png;*.jpg;*.jpeg;*.webp;").then((f) => {
      if (!f) return;
      UploadNoteImage(id, f).then(() => {
        setHasImage(true);
        // キャッシュ回避のためタイムスタンプ付きURLで再取得
        GetNoteImageURL(id).then((url) => {
          setViewImage(url ? url + "?t=" + Date.now() : noImage);
        }).catch(() => {});
        evt.showSuccessMessage(t("note.imageUploaded"));
      }).catch((err) => evt.showErrorMessage(err));
    }).catch(() => {});
  };

  const handleDeleteImage = (e) => {
    e.stopPropagation();
    setConfirmDeleteImage(true);
  };

  const handleDeleteImageConfirm = () => {
    setConfirmDeleteImage(false);
    DeleteNoteImage(id).then(() => {
      setViewImage(noImage);
      setHasImage(false);
      evt.showSuccessMessage(t("note.imageRemoved"));
    }).catch((err) => evt.showErrorMessage(err));
  };

  const isIndex = id === "index";
  const aliasStart = isIndex ? "/" : "/pages/";

  return (<>
    <MetaDialog
      open={open} onClose={onClose} title={t("note.editTitle")}
      id={id} onSave={handleSave}
      isPrivate={isPrivate} onPrivateChange={setIsPrivate}
      onDelete={() => setConfirmDelete(true)} deleteDisabled={isIndex}
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
        <FormLabel>{t("note.layoutTemplate")}</FormLabel>
        <Select size="small" value={layout} onChange={(e) => setLayout(e.target.value)}>
          {layouts.map((v) => <MenuItem key={"Layout-" + v.id} value={v.id}>{v.name}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>{t("note.contentTemplate")}</FormLabel>
        <Select size="small" value={content} onChange={(e) => setContent(e.target.value)}>
          {contents.map((v) => <MenuItem key={"Content-" + v.id} value={v.id}>{v.name}</MenuItem>)}
        </Select>
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
              onChange={(e) => { if (!isIndex) setAlias(e.target.value); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><FormLabel>{aliasStart}</FormLabel></InputAdornment>,
                endAdornment: <InputAdornment position="end"><FormLabel>.html</FormLabel></InputAdornment>,
              }} />
          </FormControl>

          <FormControl>
            <FormLabel>{t("note.noteImage")}</FormLabel>
            <Container style={{ marginTop: "4px", textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={viewImage}
                  onError={(e) => { e.target.src = noImage; }}
                  onClick={selectFile}
                  style={{ height: "160px", width: "fit-content", cursor: "pointer", opacity: 0.85, display: "block" }}
                  title={t("note.clickToSelectImage")}
                />
                {hasImage && (
                  <IconButton
                    size="small"
                    onClick={handleDeleteImage}
                    style={{ position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", padding: "2px" }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                )}
              </div>
            </Container>
          </FormControl>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px", alignItems: "center", flex: 1 }}>
              <PublishDateField label={t("meta.publishDate")} value={publish} />
              <PublishDateField label={t("meta.republishDate")} value={republish} />
            </Box>
            <Button
              size="small" variant="outlined"
              onClick={() => { const now = new Date(); setPublish(now); setRepublish(now); }}
              disabled={!publish}
              sx={{ borderColor: "var(--accent-blue)", color: "var(--accent-blue)", whiteSpace: "nowrap" }}
            >
              {t("meta.resetNow")}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </MetaDialog>

    <ConfirmDialog
      open={confirmDelete}
      title={t("note.deleteTitle")}
      message={t("note.deleteConfirm", { name })}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={handleDeleteConfirm}
    />

    <ConfirmDialog
      open={confirmDeleteImage}
      title={t("note.deleteImageTitle")}
      message={t("note.deleteImageConfirm")}
      onCancel={() => setConfirmDeleteImage(false)}
      onConfirm={handleDeleteImageConfirm}
    />
  </>);
}

export default NoteMetaDialog;
