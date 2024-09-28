import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { SelectFile, EditAsset, GetAsset, RemoveAsset } from "../../wailsjs/go/api/App";
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
  const { mode, currentId } = useParams();

  const [id, setId] = useState("");
  const [parentId, setParentId] = useState("");

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");
  const [file, setFile] = useState("");

  useEffect(() => {

    if (!currentId) {
      return;
    }

    setName("");
    setDetail("")
    setAlias("")
    setFile("")

    if (mode === "register") {
      setId("");
      setParentId(currentId);
      Event.changeTitle("Register Assets");
      return;
    } else {
      setId(currentId)
    }

    GetAsset(currentId).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail)
      setParentId(data.parentId);
      Event.changeTitle("Edit Assets:" + data.name);
    }).catch((err) => {
      Message.showError(err);
    })
  }, [currentId]);

  //保存
  const handleSave = () => {

    if (mode === "register") {
      if (file == "") {
        Message.showWarning("Choose a File")
        return;
      }
    }
    var data = {};
    data.id = id
    data.parentId = parentId

    data.name = name
    data.alias = alias
    data.detail = detail

    EditAsset(data, file).then((resp) => {
      Event.refreshTree();
      if (mode === "register") {
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
      Message.showSuccess("Remove Assets.")
      nav("/note/edit/" + parentId);
    }).catch((err) => {
      Message.showError(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(props.id);
    Message.showSuccess("Copied.");
  }

  var start = "/assets/{noteAlias}/";

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: (<InputAdornment position="start" className="linkBtn"> <ContentCopy /> </InputAdornment>)
              }}>
            </TextField>
          </FormControl>

          <FormControl>
            <FormLabel>Alias</FormLabel>
            <TextField
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">
                  <FormLabel>{start}</FormLabel>
                </InputAdornment>,
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
            startAdornment: (<InputAdornment position="start"> <AttachFileIcon /> </InputAdornment>)
          }}>
        </TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {mode === "register" && <> Create </>}
          {mode === "edit" && <> Save </>}
        </Button>

        {mode === "edit" &&
          <Button style={{ marginLeft: "auto" }}
            variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        }
      </FormControl>
    </Grid>
  </>);
}
export default Assets;