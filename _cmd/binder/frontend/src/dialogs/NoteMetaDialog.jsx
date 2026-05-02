import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Checkbox,
  Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormControlLabel, FormLabel, IconButton, InputAdornment,
  Select, TextField, MenuItem, Typography,
} from "@mui/material";
import { Check as CheckIcon, Close as CloseIcon, DeleteOutline, ExpandMore } from "@mui/icons-material";
import PublishDateField from "./components/PublishDateField";

import {
  GetNote, GetHTMLTemplates, GetNoteImageURL, DeleteNoteImage, UploadNoteImage,
  EditNote, RemoveNote, PrivatizeChildren,
} from "../../bindings/binder/api/app";
import { SelectFile } from "../../bindings/main/window";
import noImage from '../assets/images/noimage.png';
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import MetaDialog from "./components/MetaDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import { ActionButton } from "./components/ActionButton";
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
  const { showError, showWarning } = useDialogMessage();
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
  const [privateConfirm, setPrivateConfirm] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(false);
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
    }).catch((err) => showError(err));

    GetNoteImageURL(id).then((url) => {
      setViewImage(url || noImage);
      setHasImage(!!url);
    }).catch(() => { setViewImage(noImage); setHasImage(false); });
  }, [open, id]);

  const buildNote = () => ({
    id, parentId, name, alias, detail, private: isPrivate,
    layoutTemplate: layout, contentTemplate: content,
    publish: publish || ZERO_TIME,
    republish: republish || ZERO_TIME,
  });

  const doEditNote = (note, afterEdit) => {
    EditNote(note, "").then(() => {
      evt.markModified(id);
      evt.refreshTree();
      if (afterEdit) return afterEdit();
      evt.showSuccessMessage(t("note.updateSuccess"));
      onClose();
    }).catch((err) => {
      if (typeof err === 'string' && err.includes("duplicate alias")) {
        showWarning(t("common.aliasDuplicate"));
      } else {
        showError(err);
      }
    });
  };

  const handleSave = () => {
    if (!name) { showWarning(t("note.nameRequired")); return; }
    if (!layout || !content) { showWarning(t("note.chooseTemplate")); return; }
    if (!alias && id !== "index") { showWarning(t("note.aliasRequired")); return; }

    if (isPrivate) {
      setIncludeChildren(false);
      setPrivateConfirm(true);
      return;
    }
    doEditNote(buildNote());
  };

  const handlePrivateConfirm = () => {
    setPrivateConfirm(false);
    const note = buildNote();
    if (includeChildren) {
      doEditNote(note, () =>
        PrivatizeChildren(id).then(() => {
          evt.showSuccessMessage(t("note.updateSuccess"));
          onClose();
        }).catch((err) => showError(err))
      );
    } else {
      doEditNote(note);
    }
  };

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    RemoveNote(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage(t("note.removeSuccess"));
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => showError(err));
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
      }).catch((err) => showError(err));
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
    }).catch((err) => showError(err));
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

    <Dialog
      open={privateConfirm}
      onClose={() => setPrivateConfirm(false)}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", minWidth: 400 } }}
    >
      <DialogTitle>{t("note.privateConfirmTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--text-secondary)", mb: 1 }}>
          {t("note.privateConfirmMessage")}
        </DialogContentText>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={includeChildren}
              onChange={(e) => setIncludeChildren(e.target.checked)}
            />
          }
          label={<Typography variant="body2">{t("note.privateConfirmChildren")}</Typography>}
        />
      </DialogContent>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setPrivateConfirm(false)} />
        <ActionButton variant="confirm" label={t("common.execute")} icon={<CheckIcon />} onClick={handlePrivateConfirm} />
      </DialogActions>
    </Dialog>

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
