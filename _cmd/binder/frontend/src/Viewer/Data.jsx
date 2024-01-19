import { useState,useEffect } from "react";

import {SelectFile,EditData,GetData} from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, TextField } from "@mui/material";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Data(props) {

  const [name, setName] = useState("");

  useEffect( () => {
    if ( props.id === "" ) return;
    GetData(props.id,props.noteId).then( (data) => {
      setName(data.name);
    }).catch( (err) => {
      console.warn(err);
    })
  },[props.id,props.noteId]);

  const handleSave = () => {

    var data = {};
    data.id = props.id
    data.noteId = props.noteId
    data.name = name

    EditData(data).then((resp) => {
      if ( props.id === "" ) {
        props.onChangeMode("editor",resp.id,resp.noteId);
      }
    }).catch( (err) => {
      console.warn(err);
    });
  }

  const selectFile = () => {
    SelectFile("Any File","*").then((f) => {
      setFile(f);
    }).catch( (err) => {
      console.log(err);
    });
  }

  return (<>
<Grid style={{margin:"40px",marginTop:"20px",display:"flex",flexFlow:"column"}}>

  <FormControl>
    <FormLabel>Name</FormLabel>
    <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
  </FormControl>

  <FormControl style={{display:"flex",flexFlow:"row",margin:"10px"}}>
    <Button variant="contained" onClick={handleSave}>
{props.id !== "" && <> Save </> }
{props.id === "" && <> Create </> }
    </Button>
  </FormControl>

</Grid>
    </>);
}
export default Data;