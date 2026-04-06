import { useEffect, useState, useContext } from "react";

import { GetHistories } from "../../bindings/binder/api/app";
import { OpenOverallHistoryWindow } from "../../bindings/main/window";
import { List, ListItemButton, ListItemText, IconButton, Tooltip } from "@mui/material";
import HistoryIcon from '@mui/icons-material/History';

import {EventContext} from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * 履歴からバインダーの選択を行う
 * @param {*} props
 * @returns
 */
function BinderHistory(props) {

  const evt = useContext(EventContext)
  const { t } = useTranslation();
  const [histories, setHistories] = useState([]);

  useEffect(() => {
    GetHistories().then((s) => {
      setHistories(s);
    });
  }, [])

  //保存
  const handleSelect = (val) => {
    evt.openBinder(val);
  }

  return (<>
    <h3 style={{ margin: "10px", color: "var(--text-primary)" }}>History</h3>
    <List key="historyList">
      {histories.map((p) => {
        return (
          <ListItemButton key={p} onClick={() => handleSelect(p)} >
            <ListItemText style={{ color: "var(--text-primary)" }} primary={p} />
            <Tooltip title={t('binderHistory.history')} placement="left">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); OpenOverallHistoryWindow(p); }}
                sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemButton>
        )
      })}
    </List>

  </>);
}
export default BinderHistory;
