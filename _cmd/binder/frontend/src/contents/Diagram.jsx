import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";

import { ContentCopy } from "@mui/icons-material";
import { EditDiagram, GetDiagram ,RemoveDiagram} from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import Event from "../Event";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Diagram(props) {

  const nav = useNavigate();
  const {mode,currentId} = useParams();

  const [id, setId] = useState("");
  const [parentId, setParentId] = useState("");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    if ( !currentId ) {
      return;
    }

    setName("");
    setDetail("");

    if ( mode === "register" ) {
      setId("");
      setParentId(currentId);
      Event.changeTitle("Register Diagram");
      return;
    } else {
      setId(currentId);
    }

    GetDiagram(currentId).then((data) => {
      setName(data.name);
      setDetail(data.detail);
      setParentId(data.parentId);
      Event.changeTitle("Edit Diagram:" + data.name);
    }).catch((err) => {
      Event.showErrorMessage(err);
    })

  }, [currentId]);

  const handleSave = () => {

    var data = {};
    data.id = id
    data.parentId = parentId
    data.name = name
    data.detail = detail

    EditDiagram(data).then((resp) => {

      Event.refreshTree();

      //新規作成時は移動
      if ( mode === "register" ) {
        nav("/diagram/edit/" + resp.id);
        return;
      }
      Event.showSuccess("Update Diagram.");

    }).catch((err) => {
      Event.showErrorMessage(err)
    });
  }

  const handleDelete = () => {

    RemoveDiagram(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Event.showSuccess("Remove Diagram.")
      nav("/note/edit/" + parentId);
    }).catch( (err) => {
      Event.showErrorMessage(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(id);
    Event.showSuccess("Copied.");
  }

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: ( <InputAdornment position="start"> <ContentCopy/> </InputAdornment>)
              }}>
            </TextField>
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
export default Diagram;