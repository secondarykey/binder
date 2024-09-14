import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import { SelectFile, EditNote, Address, RemoveNote } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";
import { GetNote } from "../../wailsjs/go/api/App";
import noImage from '../assets/images/noimage.png'

import { Button, Container, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { ContentCopy } from "@mui/icons-material";

import Event from "../Event";
/**
 * ノートのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Note(props) {

  const {mode,currentId} = useParams();

  const [id, setId] = useState("");
  const [parentId, setParentId] = useState("");

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [viewImage, setViewImage] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    if ( !currentId ) {
      return;
    }

    setName("");
    setDetail("");
    setImageFile("");

    if ( mode === "register" ) {
      setId("");
      setParentId(currentId)

      Event.changeTitle("Register Note");
      return;
    } else {
      setId(currentId);
    }

    GetNote(currentId).then((note) => {

      setName(note.name);
      setDetail(note.detail)
      setParentId(note.parentId)

      Event.changeTitle("Edit Note:" + note.name);

    }).catch((err) => {
      Event.showErrorMessage(err);
    })

    Address().then((address) => {
      setViewImage(address + "/assets/" + id + "/index")
    }).catch((err) => {
      Event.showErrorMessage(err);
    })

  }, [currentId]);

  const handleSave = () => {

    var note = {};
    note.id = id;
    note.parentId = parentId;
    note.name = name;
    note.detail = detail;

    EditNote(note, imageFile).then((resp) => {

      //新規作成時のみ切り替え
      if (mode === "register") {
        nav("/note/edit/" + resp.id);
        return;
      }

      Event.refreshTree();
      Event.showSuccess("Update Note.")
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
  }

  //削除
  const handleDelete = () => {
    RemoveNote(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Event.showSuccess("Remove Note.")
      nav("/note/edit/" + parentId);
    }).catch( (err) => {
      Event.showErrorMessage(err);
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
      Event.showErrorMessage(err);
    });
  }

  const setNoImage = (e) => {
    e.target.src = noImage;
  }

  const copyId = (e) => {
    copyClipboard(id);
    Event.showSuccess("Copied.");
  }

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ContentCopy onClick={copyId}/>
                  </InputAdornment>
                )
              }}></TextField>
          </FormControl>
        </>
      }

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
          </FormControl>
        </>}

      <FormControl>
        <FormLabel>Note Image</FormLabel>
        <TextField value={imageFile}
          onClick={selectFile}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AttachFileIcon />
              </InputAdornment>
            )
          }}></TextField>
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
          <Button style={{marginLeft:"auto"}}
                  variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        }
      </FormControl>

    </Grid>
  </>);
}
export default Note;