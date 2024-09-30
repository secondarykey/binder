import { useEffect, useState } from "react";

import { SelectDirectory, CreateRemoteBinder } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';
import Message from "../Message";
import Event from "../Event";

/**
 * Binder新規作成
 * @param {*} props 
 * @returns 
 */
function BinderRemote(props) {

  const [remote, setRemote] = useState("");
  const [dir, setDir] = useState("");

  useEffect( () => {
    Event.changeTitle("Remote Import");
  },[])

  //保存
  const handleSave = () => {

    if ( remote == "" ) {
      Message.showWarning("input remote URL");
      return;
      }

    if ( dir == "" ) {
      Message.showWarning("choose directory");
      return;
    }

    CreateRemoteBinder(remote,dir).then(() => {

      //TODO アドレス変更通知

      //開く
      nav("/binder/");

    }).catch( (err)=> {
      Message.showError(err);
    })
  }

  const selectDir = () => {
    SelectDirectory(true).then((f) => {
      if (f != "") {
        setDir(f);
      }
    }).catch((err) => {
      Message.showError(err)
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