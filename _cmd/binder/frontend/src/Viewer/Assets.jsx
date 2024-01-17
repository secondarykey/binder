import { useState } from "react";

import {SelectFile,CreateData} from "../../wailsjs/go/main/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
/**
 * データのメタ情報を表示、編集
 * @param {*} props 
 * @returns 
 */
function Assets(props) {

    const [file, setFile] = useState("");
    const [name, setName] = useState("");

    const handleSave = () => {
      EditAssets(props.id,props.noteId,name,"",file).then((resp) => {
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
{props.id !== "" &&
  <FormControl>
    <FormLabel>Name</FormLabel>
    <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
  </FormControl>
}

  <FormControl>
    <FormLabel>Assets</FormLabel>
    <TextField value={file} onClick={selectFile}
      InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AttachFileIcon />
            </InputAdornment>
          )}}>
      </TextField>
  </FormControl>

  <FormControl style={{display:"flex",flexFlow:"row",margin:"10px"}}>
    <Button variant="contained" onClick={handleSave}>
{props.id !== "" &&
<>
      Save
</>
}
{props.id === "" &&
<>
      Create
</>
}
    </Button>
  </FormControl>

</Grid>
    </>);
}
export default Assets;