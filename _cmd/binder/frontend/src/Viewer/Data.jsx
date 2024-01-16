import { useState } from "react";

import {SelectFile,CreateData} from "../../wailsjs/go/main/App";
import { Button, FormControl, FormLabel, Grid, TextField } from "@mui/material";
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Data(props) {

    const [file, setFile] = useState("");
    const [name, setName] = useState("");

    const handleSave = () => {
      CreateData("","",name,"").then((resp) => {
        props.onChangeMode("editor",resp.ID,resp.NoteId);
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
    <Button variant="contained" onClick={handleSave}>Save</Button>
  </FormControl>

</Grid>
    </>);
}
export default Data;