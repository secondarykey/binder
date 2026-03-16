import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";
import {
  Button, Container, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle,
  FormControl, FormLabel, Grid, IconButton, InputAdornment, Select, TextField, MenuItem,
} from "@mui/material";
import { ContentCopy, DeleteOutline } from "@mui/icons-material";

import { copyClipboard } from "../App";
import {
  GetNote, GetHTMLTemplates, GetNoteImageURL, DeleteNoteImage,
  EditNote, RemoveNote,
} from "../../bindings/binder/api/app";
import { SelectFile } from "../../bindings/main/window";
import noImage from '../assets/images/noimage.png';
import { EventContext } from "../Event";

/**
 * ノートのメタデータ編集ダイアログ
 * @param {{ open: boolean, id: string, onClose: () => void }} props
 */
function NoteMetaDialog({ open, id, onClose }) {
  const evt = useContext(EventContext);
  const nav = useNavigate();

  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [viewImage, setViewImage] = useState(noImage);
  const [hasImage, setHasImage] = useState(false);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(false);
  const [detail, setDetail] = useState("");
  const [layout, setLayout] = useState("");
  const [content, setContent] = useState("");
  const [layouts, setLayouts] = useState([]);
  const [contents, setContents] = useState([]);

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
    setName(""); setAlias(""); setDetail("");
    setImageFile(""); setViewImage(noImage); setHasImage(false);

    GetNote(id).then((note) => {
      setName(note.name);
      setAlias(note.alias);
      setDetail(note.detail);
      setParentId(note.parentId);
      setLayout(note.layoutTemplate);
      setContent(note.contentTemplate);
    }).catch((err) => evt.showErrorMessage(err));

    GetNoteImageURL(id).then((url) => {
      setViewImage(url || noImage);
      setHasImage(!!url);
    }).catch(() => { setViewImage(noImage); setHasImage(false); });
  }, [open, id]);

  const handleSave = () => {
    if (!name) { evt.showWarningMessage("name is required."); return; }
    if (!layout || !content) { evt.showWarningMessage("Choose a Template."); return; }
    if (!alias && id !== "index") { evt.showWarningMessage("alias is required."); return; }

    const note = { id, parentId, name, alias, detail, layoutTemplate: layout, contentTemplate: content };
    EditNote(note, imageFile).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Update Note.");
      onClose();
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleDelete = () => {
    RemoveNote(id).then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Remove Note.");
      onClose();
      nav("/editor/note/" + parentId);
    }).catch((err) => evt.showErrorMessage(err));
  };

  const selectFile = () => {
    SelectFile("Page Image File", "*.png;*.jpg;*.jpeg;*.webp;").then((f) => {
      if (f) setImageFile(f);
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
      setImageFile("");
      evt.showSuccessMessage("Image removed.");
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleCopyId = () => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  };

  const isIndex = id === "index";
  const aliasStart = isIndex ? "/" : "/pages/";

  return (<>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>Edit Note</DialogTitle>
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
              onChange={(e) => { if (!isIndex) setAlias(e.target.value); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><FormLabel>{aliasStart}</FormLabel></InputAdornment>,
                endAdornment: <InputAdornment position="end"><FormLabel>.html</FormLabel></InputAdornment>,
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

          <FormControl>
            <FormLabel>Layout Template</FormLabel>
            <Select size="small" value={layout} onChange={(e) => setLayout(e.target.value)}>
              {layouts.map((v) => <MenuItem key={"Layout-" + v.id} value={v.id}>{v.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Content Template</FormLabel>
            <Select size="small" value={content} onChange={(e) => setContent(e.target.value)}>
              {contents.map((v) => <MenuItem key={"Content-" + v.id} value={v.id}>{v.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Note Image</FormLabel>
            <Container style={{ marginTop: "4px", textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={viewImage}
                  onError={(e) => { e.target.src = noImage; }}
                  onClick={selectFile}
                  style={{ height: "160px", width: "fit-content", cursor: "pointer", opacity: 0.85, display: "block" }}
                  title="クリックして画像を選択"
                />
                {(hasImage || imageFile) && (
                  <IconButton
                    size="small"
                    onClick={handleDeleteImage}
                    style={{ position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", padding: "2px" }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                )}
              </div>
              {imageFile && (
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", wordBreak: "break-all" }}>
                  {imageFile.split(/[\\/]/).pop()}
                </div>
              )}
            </Container>
          </FormControl>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDelete} color="error" disabled={isIndex}>Delete</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>

    {/* 画像削除確認ダイアログ */}
    <Dialog
      open={confirmDeleteImage}
      onClose={() => setConfirmDeleteImage(false)}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } }}
    >
      <DialogTitle>画像の削除</DialogTitle>
      <DialogContentText style={{ padding: "0 24px 8px", color: "var(--text-secondary)" }}>
        メタ画像を削除しますか？
      </DialogContentText>
      <DialogActions>
        <Button onClick={() => setConfirmDeleteImage(false)}>キャンセル</Button>
        <Button color="error" onClick={handleDeleteImageConfirm}>削除</Button>
      </DialogActions>
    </Dialog>
  </>);
}

export default NoteMetaDialog;
