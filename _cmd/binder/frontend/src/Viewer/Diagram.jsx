import { useState, useEffect } from "react";

import { EditDiagram, GetDiagram } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Diagram(props) {

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    if (props.id === "") {
      setName("");
      setDetail("");
      props.onChangeTitle("Create Data");
      return;
    }

    GetDiagram(props.id).then((data) => {
      setName(data.name);
      setDetail(data.detail);
      props.onChangeTitle("Edit Data:" + data.name);
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
  }, [props.id]);

  const handleSave = () => {

    var data = {};
    data.id = props.id
    data.parentId = props.parentId
    data.name = name
    data.detail = detail

    EditDiagram(data).then((resp) => {
      if (props.id === "") {
        props.onChangeMode("diagramEditor", resp.id);
      }
      props.onRefreshTree();
      props.onMessage("success", "update data.")

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

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {props.id !== "" && <> Save </>}
          {props.id === "" && <> Create </>}
        </Button>
      </FormControl>

    </Grid>
  </>);
}
export default Diagram;