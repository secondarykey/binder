import { useState } from "react";

import { SelectDirectory, CreateBinder } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

/**
 * Binder新規作成
 * @param {*} props 
 * @returns 
 */
function BinderRegister(props) {

  const [dir, setDir] = useState("");

  props.onChangeTitle("Create Binder");

  //保存
  const handleSave = () => {
    if ( dir == "" ) {
      props.onMessage("error","reqired select directory");
      return;
    }
    CreateBinder(dir,"simple",true).then(() => {
      //開く
      props.onChangeMode("loadBinder");
    }).catch( (err)=> {
      console.warn(err);
      props.onMessage("error",err);
    })
  }

  const selectDir = () => {
    SelectDirectory(true).then((f) => {
      if (f != "") {
        setDir(f);
      }
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Binder Directory</FormLabel>
        <TextField value={dir} onClick={selectDir}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FolderIcon />
              </InputAdornment>
            )
          }}>
        </TextField>
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          <> Create </>
        </Button>
      </FormControl>
    </Grid>
  </>);
}
export default BinderRegister;