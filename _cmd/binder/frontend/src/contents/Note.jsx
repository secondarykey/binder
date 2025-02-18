import { useState, useEffect,useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Container, FormControl, FormLabel, Grid, InputAdornment, Select, TextField, MenuItem } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { ContentCopy } from "@mui/icons-material";

import { copyClipboard } from "../App";
import { GetNote, GetHTMLTemplates } from "../../wailsjs/go/api/App";
import { SelectFile, EditNote, RemoveNote,Address } from "../../wailsjs/go/api/App";
import noImage from '../assets/images/noimage.png'

import Event,{EventContext} from "../Event";

/**
 * ノートのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Note(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const { mode, currentId } = useParams();

  const [id, setId] = useState("");
  const [parentId, setParentId] = useState("");

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [imageFile, setImageFile] = useState("");

  const [address, setAddress] = useState("");
  const [viewImage, setViewImage] = useState("");
  const [detail, setDetail] = useState("");

  const [layout, setLayout] = useState("");
  const [content, setContent] = useState("");
  const [layouts, setLayouts] = useState([]);
  const [contents, setContents] = useState([]);

  /**
   * ID変更時操作
   */
  useEffect(() => {

    if (!currentId) {
      return;
    }

    setName("");
    setAlias("");
    setDetail("");
    setImageFile("");

    if (mode === "register") {
      setId("");
      setParentId(currentId)
      evt.changeTitle("Register Note");
      return;
    } else {
      setId(currentId);
    }

    GetNote(currentId).then((note) => {

      setName(note.name);
      setAlias(note.alias);
      setDetail(note.detail)
      setParentId(note.parentId)

      setLayout(note.layoutTemplate)
      setContent(note.contentTemplate)

      evt.changeTitle("Edit Note:" + note.name);

    }).catch((err) => {
      evt.showErrorMessage(err);
    })

    setViewImage(address + "/assets/meta");

  }, [currentId]);

  /**
   * 初期処理
   */
  useEffect(() => {

    //アドレス変更時の処理
    evt.register("Note",Event.ChangeAddress,function(arg) {
      setAddress(arg);
    });

    GetHTMLTemplates().then((tmpls) => {
      setLayouts(tmpls.layouts)
      setContents(tmpls.contents)

      if (mode === "register") {
        setLayout(tmpls.layouts[0].id)
        setContent(tmpls.contents[0].id)
      }

    }).catch((err) => {
      evt.showErrorMessage(err);
    })

    Address().then((arg) => {
      setAddress(arg);
    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  }, []);

  /**
   * 保存処理
   */
  const handleSave = () => {

    var note = {};
    note.id = id;
    note.parentId = parentId;
    note.name = name;
    note.alias = alias;
    note.detail = detail;
    note.layoutTemplate = layout;
    note.contentTemplate = content;

    if ( name === "" ) {
      evt.showWarningMessage("name is required.");
      return;
    }
    if ( layout === "" || content === "" ) {
      evt.showWarningMessage("Choose a Template.");
      return;
    }

    if ( mode !== "register") {
      if ( alias === "" ) {
        evt.showWarningMessage("alias is required.");
        return;
      }
    }

    EditNote(note, imageFile).then((resp) => {

      evt.refreshTree();
      //新規作成時のみ切り替え
      if (mode === "register") {
        nav("/note/edit/" + resp.id);
        return;
      }

      evt.showSuccessMessage("Update Note.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  /**
   * 削除処理
   */
  const handleDelete = () => {
    RemoveNote(id).then((resp) => {
      evt.refreshTree();
      // 遷移する
      evt.showSuccessMessage("Remove Note.")
      nav("/note/edit/" + parentId);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /**
   * ファイル選択
   */
  const selectFile = () => {
    SelectFile("Page Image File", "*.png;*.jpg;*.jpeg;*.webp;").then((f) => {
      if (f != "") {
        setImageFile(f);
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const setNoImage = (e) => {
    e.target.src = noImage;
  }

  /**
   * IDコピー処理
   * @param {*} e 
   */
  const handleCopyId = (e) => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  }

  /**
   * レイアウトテンプレート変更
   * @param {*} e 
   */
  const handleChangeLayout = (e) => {
    setLayout(e.target.value);
  }
  /**
   * コンテンツテンプレート変更
   * @param {*} e 
   */
  const handleChangeContent = (e) => {
    setContent(e.target.value);
  }

  var start = "/pages/"
  var index = false;
  var changeFunc = setAlias;
  if (id == "index") {
    start = "/";
    index = true;
    changeFunc = function (v) { };
  }
  var end = ".html";
  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: (<InputAdornment position="start"><ContentCopy /></InputAdornment>)
              }}>
            </TextField>
          </FormControl>

          <FormControl>
            <FormLabel>Alias</FormLabel>
            <TextField
              value={alias}
              onChange={(e) => changeFunc(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">
                  <FormLabel>{start}</FormLabel>
                </InputAdornment>,
                endAdornment: <InputAdornment position="end">
                  <FormLabel>{end}</FormLabel>
                </InputAdornment>,
              }}>
            </TextField>
          </FormControl>
        </>
      }

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel> Layout Template </FormLabel>

        <Select value={layout} onChange={(e) => handleChangeLayout(e)}>
          {layouts.map((v) => {
            return (<MenuItem key={"Layout-" + v.id} value={v.id}>{v.name}</MenuItem>)
          })}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel> Content Template </FormLabel>
        <Select value={content} onChange={(e) => handleChangeContent(e)}>
          {contents.map((v) => {
            return (<MenuItem key={"Content-" + v.id} value={v.id}>{v.name}</MenuItem>)
          })}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Note Image</FormLabel>
        <TextField value={imageFile} className="linkBtn" onClick={selectFile}
          InputProps={{
            startAdornment: (<InputAdornment position="start"> <AttachFileIcon /> </InputAdornment>)
          }}>
        </TextField>
      </FormControl>

      {(mode === "edit" && viewImage !== "") &&
        <>
          <Container style={{ marginTop: "10px", textAlign: "center" }}>
            <img src={viewImage} onError={setNoImage} style={{ height: "200px", width: "fit-content" }}></img>
          </Container>
        </>
      }

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {mode === "register" && <> Create </>}
          {mode === "edit" && <> Save </>}
        </Button>

        {mode === "edit" &&
          <Button style={{ marginLeft: "auto" }}
            variant="contained" color="error" onClick={handleDelete} disabled={index}>Delete</Button>
        }
      </FormControl>

    </Grid>
  </>);
}
export default Note;