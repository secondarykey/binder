import { useEffect, useState } from "react";

import { SelectFile, EditAsset, GetAsset } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopy from '@mui/icons-material/ContentCopy';
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Assets(props) {

  const [name, setName] = useState("");
  const [file, setFile] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    setFile("");
    setDetail("")
    if (props.id === "") {
      props.onChangeTitle("Create Assets");
      return;
    }

    GetAsset(props.id, props.noteId).then((data) => {
      setName(data.name);
      setDetail(data.detail)
      props.onChangeTitle("Edit Assets:" + data.name);
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
  }, [props.id, props.noteId]);

  //保存
  const handleSave = () => {
    var data = {};
    data.id = props.id
    data.noteId = props.noteId
    data.name = name
    data.detail = detail
    data.pluginId = "assets";

    EditAsset(data, file).then((resp) => {
      props.onRefreshTree();
      //props.onChangeMode("editor",resp.ID,resp.NoteId);
      props.onMessage("success", "update assets");
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  const selectFile = () => {
    SelectFile("Any File", "*").then((f) => {
      if (f != "") {
        setFile(f);
      }
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
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
          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
          </FormControl>
        </>
      }

      <FormControl>
        <FormLabel>Assets</FormLabel>
        <TextField value={file} onClick={selectFile}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AttachFileIcon />
              </InputAdornment>
            )
          }}>
        </TextField>
      </FormControl>

      {props.id !== "" &&
        <>
          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
          </FormControl>
        </>}

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {props.id !== "" && <> Save </>}
          {props.id === "" && <> Create </>}
        </Button>
      </FormControl>
    </Grid>
  </>);
}
export default Assets;