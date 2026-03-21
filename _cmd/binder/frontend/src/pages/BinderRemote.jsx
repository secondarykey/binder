import { useEffect, useState ,useContext} from "react";

import { CreateRemoteBinder } from "../../bindings/binder/api/app";
import { SelectDirectory} from "../../bindings/main/window";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

import Event,{EventContext} from "../Event";

/**
 * Binderリモート作成
 * @param {*} props 
 * @returns 
 */
function BinderRemote(props) {

  const evt = useContext(EventContext)

  const [remote, setRemote] = useState("");
  const [dir, setDir] = useState("");

  useEffect( () => {
    evt.changeTitle("Remote Import");
  },[])

  //保存
  const handleSave = () => {

    if ( remote == "" ) {
      evt.showWarningMessage("input remote URL");
      return;
      }

    if ( dir == "" ) {
      evt.showWarningMessage("choose directory");
      return;
    }

    CreateRemoteBinder(remote,dir).then(() => {

      //TODO アドレス変更通知

      //開く
      nav("/binder/");

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
      evt.showErrorMessage(err)
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