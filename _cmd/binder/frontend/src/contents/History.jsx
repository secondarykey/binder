import { useEffect, useState, useContext } from "react";

import { LoadBinder, GetSetting } from "../../bindings/binder/api/app";
import { List, ListItemButton, ListItemText } from "@mui/material";
import { useNavigate } from "react-router";

import {EventContext} from '../Event';

/**
 * 履歴からバインダーの選択を行う
 * @param {*} props 
 * @returns 
 */
function History(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const [histories, setHistories] = useState([]);

  useEffect(() => {
    GetSetting().then((s) => {
      setHistories(s.path.histories);
    });
  }, [])

  //保存
  const handleSelect = (val) => {
    LoadBinder(val).then((href) => {
     
      console.log(href)
      evt.changeAddress(href);

      nav("/note/edit/index");

    }).catch((err) => {
      evt.showErrorMessage(err)
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