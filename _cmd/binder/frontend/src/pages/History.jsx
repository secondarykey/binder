import { useEffect, useState, useContext } from "react";

import { LoadBinder, GetHistories } from "../../bindings/binder/api/app";
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
    GetHistories().then((s) => {
      setHistories(s);
    });
  }, [])

  //保存
  const handleSelect = (val) => {
    LoadBinder(val).then((href) => {
     
      console.log(href)
      evt.changeAddress(href);

      nav("/editor/note/index");

    }).catch((err) => {
      evt.showErrorMessage(err)
    })
  }

  return (<>
    <h3 style={{ margin: "10px", color: "var(--text-primary)" }}>History</h3>
    <List key="historyList">
      {histories.map((p) => {
        return (
          <ListItemButton key={p} onClick={() => handleSelect(p)} >
            <ListItemText style={{ color: "var(--text-primary)" }} primary={p} />
          </ListItemButton>
        )
      })}
    </List>

  </>);
}
export default History;