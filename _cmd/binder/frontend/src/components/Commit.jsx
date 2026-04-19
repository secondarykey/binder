import { useEffect, useState,useContext } from "react";
import { useParams } from "react-router";
import { Grid, TextField, FormControl, FormLabel, IconButton, LinearProgress, Tooltip } from "@mui/material";
import CheckIcon from '@mui/icons-material/Check';

import Event,{EventContext} from '../Event';
import { ActionButton } from '../dialogs/components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * 編集を行っているファイルのコミットを行うコンポーネント
 * @param {*} props 
 * @returns 
 */
function Commit({ date: dateProp, ...props }) {

  const evt = useContext(EventContext)
  const {t} = useTranslation();
  const [comment, setComment] = useState("Updated:");
  const [running, setRunning] = useState(false);
  const { date: paramDate } = useParams();
  const date = dateProp ?? paramDate;

  useEffect(() => {
    evt.register("Commit",Event.ModifiedComment,function(comment) {
      setComment(comment);
    })
    evt.register("Commit", Event.ModifiedProgress, function(progress) {
      setRunning(progress.running);
    })
  }, [date])

  //保存
  const handleCommit = () => {
    //イベントでツリー側で処理
    evt.raise(Event.ModifiedCommit,comment);
  }

  var rowNum = Math.min(comment.split("\n").length + 1, 10);
  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>{t("commitModal.commitComment")}</FormLabel>
      {/** コミットコメント */}
      <TextField
        multiline={true}
        rows={rowNum}
        value={comment} 
        style={{minWidth:"500px"}}
        onChange={(e) => setComment(e.target.value)}
      ></TextField>
       </FormControl>

      {running && <LinearProgress sx={{ mx: 1 }} />}

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px", justifyContent: "flex-end" }}>
        <ActionButton variant="save" label={t("commitModal.commit")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleCommit} disabled={running} />
       </FormControl>
    </Grid>
  </>);
}
export default Commit;