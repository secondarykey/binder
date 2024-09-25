import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { SelectFile, EditAsset, GetAsset,RemoveAsset } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopy from '@mui/icons-material/ContentCopy';

import Event from "../Event";
import Message from '../Message';

/**
 * ノートのアッセット情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Assets(props) {

  const nav = useNavigate();
  const {mode,currentId} = useParams();

  const [id,setId] = useState("");
  const [parentId,setParentId] = useState("");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [file, setFile] = useState("");

  useEffect(() => {

    if ( !currentId ) {
      return;
    }

    setName("");
    setDetail("")
    setFile("")

    if ( mode === "register") {
      setId("");
      setParentId(currentId);
      Event.changeTitle("Register Assets");
      return;
    } else {
      setId(currentId)
    }

    GetAsset(currentId).then((data) => {
      setName(data.name);
      setDetail(data.detail)
      setParentId(data.parentId);
      Event.changeTitle("Edit Assets:" + data.name);
    }).catch((err) => {
      Message.showError(err);
    })
  }, [currentId]);

  //保存
  const handleSave = () => {

    var data = {};
    data.id = id
    data.parentId = parentId

    data.name = name
    data.detail = detail

    console.log(data);
    console.log("file:" + file)

    EditAsset(data, file).then((resp) => {
      Event.refreshTree();
      if ( mode === "register" ) {
        nav("/assets/edit/" + resp.id);
        return;
      }
      Message.showSuccess("Update Assets.");
    }).catch((err) => {
      Message.showError(err);
    });
  }

  /**
   * ファイル設定
   */
  const selectFile = () => {
    SelectFile("Any File", "*").then((f) => {
      if (f != "") {
        setFile(f);
      }
    }).catch((err) => {
      Message.showError(err);
    });
  }

  /**
   * 削除
   */
  const handleDelete = () => {
    RemoveAsset(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Event.showSuccess("Remove Assets.")
      nav("/note/edit/" + parentId);
    }).catch( (err) => {
      Message.showError(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(props.id);
    Message.showSuccess("Copied.");
  }

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: ( <InputAdornment position="start" className="linkBtn"> <ContentCopy /> </InputAdornment>)
              }}>
            </TextField>
          </FormControl>

          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
          </FormControl>
        </>
      }

      <FormControl>
        <FormLabel>Assets</FormLabel>
        <TextField value={file} onClick={selectFile} className="linkBtn"
          InputProps={{
            startAdornment: ( <InputAdornment position="start"> <AttachFileIcon /> </InputAdornment>)
          }}>
        </TextField>
      </FormControl>

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
          </FormControl>
        </>}

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
export default Assets;