import { useState } from "react";

import { LoadBinder, GetSetting } from "../../wailsjs/go/api/App";
import { List, ListItemButton, ListItemText } from "@mui/material";
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

<h3 style={{margin:"10px",color:"#f1f1f1"}}>History</h3>
<List>
{
histories.map((p) => {
  return (<>
        <ListItemButton onClick={() => handleSelect(p)} >
          <ListItemText style={{color:"#f1f1f1"}} primary={p} />
        </ListItemButton>
  </>)
})
}
</List>

  </>);
}
export default BinderHistory;