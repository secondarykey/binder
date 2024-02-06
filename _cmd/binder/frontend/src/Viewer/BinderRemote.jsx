import { useEffect, useState } from "react";

import { SelectDirectory, CreateRemoteBinder } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

/**
 * Binder新規作成
 * @param {*} props 
 * @returns 
 */
function BinderRemote(props) {

  const [remote, setRemote] = useState("");
  const [dir, setDir] = useState("");

  props.onChangeTitle("Remote Import");

  //保存
  const handleSave = () => {

    if ( dir == "" ) {
      props.onMessage("error","reqired select directory");
      return;
    }

    CreateRemoteBinder(remote,dir).then(() => {
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
        <FormLabel>Repository(URL)</FormLabel>
        <TextField value={remote} onChange={(e) => setRemote(e.target.value)}></TextField>
      </FormControl>

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
export default BinderRemote;