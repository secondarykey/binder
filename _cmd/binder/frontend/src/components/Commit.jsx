import { useEffect, useState,useContext } from "react";
import { useParams } from "react-router";
import { Grid, TextField, FormControl,FormLabel,Button} from "@mui/material";

import Event,{EventContext} from '../Event';
import "../i18n/config";
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
  const { date: paramDate } = useParams();
  const date = dateProp ?? paramDate;

  useEffect(() => {
    evt.register("Commit",Event.ModifiedComment,function(comment) {
      setComment(comment);
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

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleCommit}>{t("commitModal.commit")}</Button>
       </FormControl>
    </Grid>
  </>);
}
export default Commit;