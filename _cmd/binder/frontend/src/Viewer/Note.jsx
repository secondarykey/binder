import { useState, useEffect } from "react";

import { SelectFile, EditNote, Address, RemoveNote } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";
import { GetNote } from "../../wailsjs/go/api/App";
import noImage from '../assets/images/noimage.png'

import { Button, Container, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { ContentCopy } from "@mui/icons-material";
/**
 * ノートのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Note(props) {

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [viewImage, setViewImage] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    setDetail("");
    setImageFile("");
    if (props.id === "") {
      setName("");
      props.onChangeTitle("Create Note");
      return;
    }

    GetNote(props.id).then((note) => {
      setName(note.name);
      setDetail(note.detail)
      props.onChangeTitle("Edit Note:" + note.name);
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })

    Address().then((address) => {
      setViewImage(address + "/assets/" + props.id + "/index")
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })

  }, [props.id]);

  const handleSave = () => {

    var note = {};
    note.id = props.id;
    note.parentId = props.parentId
    note.name = name;
    note.detail = detail;

    EditNote(note, imageFile).then((resp) => {

      //新規作成時のみ切り替え
      if (props.id === "") {
        console.log(resp);
        props.onChangeMode("noteEditor", resp.id,resp.parentId);
      }
      props.onRefreshTree();
      props.onMessage("success", "Update note.")

    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  //削除
  const handleDelete = () => {
    var note = {};
    note.id = props.id;
    RemoveNote(props.id).then((resp) => {
      props.onRefreshTree();
      props.onMessage("success", "Remove note.")
    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error", err);
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
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  const setNoImage = (e) => {
    e.target.src = noImage;
  }

  const copyId = (e) => {
    copyClipboard(props.id);
    props.onMessage("success","Copied.");
  }

  return (<>
    <Grid className="formGrid">

      {props.id !== "" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={props.id}
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

      {props.id !== "" &&
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

      {(props.id !== "" && viewImage !== "") &&
        <>
          <Container style={{ marginTop: "10px", textAlign: "center" }}>
            <img src={viewImage} onError={setNoImage} style={{ height: "200px", width: "fit-content" }}></img>
          </Container>
        </>
      }

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {props.id !== "" && <> Save </>}
          {props.id === "" && <> Create </>}
        </Button>
        {props.id !== "" && 
          <Button style={{marginLeft:"auto"}}
                  variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        }
      </FormControl>

    </Grid>
  </>);
}
export default Note;