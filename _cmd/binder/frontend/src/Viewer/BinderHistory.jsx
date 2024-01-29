import { useEffect, useState } from "react";

import { SelectFile, EditAssets, GetData, LoadBinder, GetSetting } from "../../wailsjs/go/api/App";
import { Button, FormControl, FormLabel, Grid, InputAdornment, List, ListItemButton, ListItemText, MenuItem, MenuList, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
/**
 * バインダーの選択を行う
 * @param {*} props 
 * @returns 
 */
function BinderHistory(props) {

  const [histories,setHistories] = useState([]);

  props.onChangeTitle("Select Binder");

  GetSetting().then((s) => {
    setHistories(s.path.histories);
  });

  //保存
  const handleSelect = (val) => {
    LoadBinder(val).then(() => {
      props.onChangeMode("loadBinder");
    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
  }

  return (<>

<h3 style={{margin:"10px"}}>History</h3>
<List>
{
histories.map((p) => {
  return (<>
        <ListItemButton onClick={() => handleSelect(p)} >
          <ListItemText primary={p} />
        </ListItemButton>
  </>)
})
}
</List>

  </>);
}
export default BinderHistory;