import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";

import { ContentCopy } from "@mui/icons-material";
import { EditDiagram, GetDiagram, RemoveDiagram } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import Event from "../Event";
import Message from '../Message';
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Diagram(props) {

  const nav = useNavigate();
  const { mode, currentId } = useParams();

  const [id, setId] = useState("");
  const [parentId, setParentId] = useState("");

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    if (!currentId) {
      return;
    }

    setName("");
    setDetail("");
    setAlias("");

    if (mode === "register") {
      setId("");
      setParentId(currentId);
      Event.changeTitle("Register Diagram");
      return;
    } else {
      setId(currentId);
    }

    GetDiagram(currentId).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setParentId(data.parentId);
      Event.changeTitle("Edit Diagram:" + data.name);
    }).catch((err) => {
      Message.showError(err);
    })

  }, [currentId]);

  const handleSave = () => {

    var data = {};
    data.id = id
    data.parentId = parentId
    data.name = name
    data.detail = detail
    data.alias = alias;

    if ( name === "" ) {
      Message.showWarning("name is required")
      return;
    }

    if ( alias === "" ) {
      Message.showWarning("alias is required")
      return;
    }

    EditDiagram(data).then((resp) => {

      Event.refreshTree();
      //新規作成時は移動
      if (mode === "register") {
        nav("/diagram/edit/" + resp.id);
        return;
      }
      Message.showSuccess("Update Diagram.");

    }).catch((err) => {
      Message.showError(err)
    });
  }

  const handleDelete = () => {

    RemoveDiagram(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Message.showSuccess("Remove Diagram.")
      nav("/note/edit/" + parentId);
    }).catch((err) => {
      Message.showError(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(id);
    Message.showSuccess("Copied.");
  }

  var start = "/images/"
  var end = ".svg";
  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: (<InputAdornment position="start"> <ContentCopy /> </InputAdornment>)
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
export default Diagram;