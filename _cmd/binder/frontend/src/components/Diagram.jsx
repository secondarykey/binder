import { useState, useEffect ,useContext} from "react";
import { useParams,useNavigate } from "react-router";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";

import { ContentCopy } from "@mui/icons-material";
import { EditDiagram, GetDiagram, RemoveDiagram } from "../../bindings/binder/api/app";
import { copyClipboard } from "../app/App";

import {EventContext} from "../Event";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Diagram(props) {

  const evt = useContext(EventContext)
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
      evt.changeTitle("Register Diagram");
      return;
    } else {
      setId(currentId);
    }

    GetDiagram(currentId).then((data) => {
      setName(data.name);
      setAlias(data.alias);
      setDetail(data.detail);
      setParentId(data.parentId);
      evt.changeTitle("Edit Diagram:" + data.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
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
      evt.showWarningMessage("name is required")
      return;
    }

    if ( mode !== "register" && alias === "" ) {
      evt.showWarningMessage("alias is required")
      return;
    }

    EditDiagram(data).then((resp) => {

      evt.refreshTree();
      //新規作成時は移動
      if (mode === "register") {
        nav("/diagram/edit/" + resp.id);
        return;
      }
      evt.showSuccessMessage("Update Diagram.");

    }).catch((err) => {
      evt.showErrorMessage(err)
    });
  }

  const handleDelete = () => {

    RemoveDiagram(id).then((resp) => {
      evt.refreshTree();
      // 遷移する
      evt.showSuccessMessage("Remove Diagram.")
      nav("/note/edit/" + parentId);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(id);
    evt.showSuccessMessage("Copied.");
  }

  var start = "/images/"
  var end = ".svg";
  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField size="small" value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: (<InputAdornment position="start"> <ContentCopy /> </InputAdornment>)
              }}>
            </TextField>
          </FormControl>

          <FormControl>
            <FormLabel>Alias</FormLabel>
            <TextField
              size="small"
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
        <TextField size="small" value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
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