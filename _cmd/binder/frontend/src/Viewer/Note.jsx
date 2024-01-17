import { useState } from "react";

import {SelectFile,CreateNote} from "../../wailsjs/go/main/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
/**
 * ノートのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Note(props) {

  const [imageFile, setImageFile] = useState("");
  const [name, setName] = useState("");

  const handleSave = () => {
    CreateNote(props.id,name,imageFile).then((resp) => {
      props.onChangeMode("editor",resp.ID);
    }).catch( (err) => {
      console.log(err);
    });
  }

  const selectFile = () => {
    SelectFile("Page Image File","*.png;*.jpg;*.jpeg;*.webp;").then((f) => {
      setImageFile(f);
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

{/**
<FormControl>
  <FormLabel>ID</FormLabel>
  <TextField></TextField>
</FormControl>
*/}

  <FormControl>
    <FormLabel>Note Image</FormLabel>
    <TextField value={imageFile}
               onClick={selectFile}
               InputProps={{
               startAdornment: (
                 <InputAdornment position="start">
                   <AttachFileIcon />
                 </InputAdornment>
               )}}></TextField>
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
export default Note;