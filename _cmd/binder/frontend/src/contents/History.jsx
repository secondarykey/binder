import { useEffect, useState } from "react";

import { LoadBinder, GetSetting } from "../../wailsjs/go/api/App";
import { List, ListItemButton, ListItemText } from "@mui/material";
import { useNavigate } from "react-router-dom";

import Message from '../Message';
/**
 * 履歴からバインダーの選択を行う
 * @param {*} props 
 * @returns 
 */
function History(props) {

  const nav = useNavigate();
  const [histories, setHistories] = useState([]);

  useEffect(() => {
    GetSetting().then((s) => {
      setHistories(s.path.histories);
    });
  }, [])

  //保存
  const handleSelect = (val) => {
    LoadBinder(val).then(() => {
      nav("/note/edit/index");
    }).catch((err) => {
      Message.showError(err)
    })
  }

  return (<>
    <h3 style={{ margin: "10px", color: "#f1f1f1" }}>History</h3>
    <List key="historyList">
      {histories.map((p) => {
        return (
          <ListItemButton key={p} onClick={() => handleSelect(p)} >
            <ListItemText style={{ color: "#f1f1f1" }} primary={p} />
          </ListItemButton>
        )
      })}
    </List>

  </>);
}
export default History;