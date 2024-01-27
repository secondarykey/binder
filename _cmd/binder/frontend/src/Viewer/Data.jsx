import { useState, useEffect } from "react";

import { SelectFile, EditData, GetData } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, TextField } from "@mui/material";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Data(props) {

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {

    if (props.id === "") {
      setName("");
      setDetail("");
      props.onChangeTitle("Create Data");
      return;
    }

    GetData(props.id, props.noteId).then((data) => {
      setName(data.name);
      setDetail(data.detail);
      props.onChangeTitle("Edit Data:" + data.name);
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
  }, [props.id, props.noteId]);

  const handleSave = () => {

    var data = {};
    data.id = props.id
    data.noteId = props.noteId
    data.name = name
    data.detail = detail
    data.pluginId = "data";

    EditData(data).then((resp) => {
      if (props.id === "") {
        props.onChangeMode("editor", resp.id, resp.noteId);
      }
      props.onRefreshTree();
      props.onMessage("success", "update data.")

    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  return (<>
    <Grid style={{ margin: "40px", marginTop: "20px", display: "flex", flexFlow: "column" }}>

      {props.id !== "" &&
        <>
          <FormControl>
            <FormLabel>ID : {props.id} </FormLabel>
          </FormControl>
        </>}

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      {props.id !== "" &&
        <>
          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline="true"></TextField>
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
export default Data;