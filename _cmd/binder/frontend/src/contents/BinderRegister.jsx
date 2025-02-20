import { useState,useContext } from "react";
import { useNavigate } from "react-router";

import { SelectDirectory, CreateBinder } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

import Event,{EventContext} from "../Event";

/**
 * Binder新規作成
 * @param {*} props 
 * @returns 
 */
function BinderRegister(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const [dir, setDir] = useState("");

  //保存
  const handleSave = () => {
    if ( dir == "" ) {
      evt.showWarningMessage("reqired select directory");
      return;
    }

    //インストールを別にする
    CreateBinder(dir,"simple").then((href) => {

      evt.changeAddress(href);
      //TODO Binder変更通知
      nav("/note/index");

    }).catch( (err)=> {
      evt.showErrorMessage(err);
    })
  }

  const selectDir = () => {
    SelectDirectory(true).then((f) => {
      if (f != "") {
        setDir(f);
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
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