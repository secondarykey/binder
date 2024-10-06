import { useEffect, useState,useContext } from "react";
import { useParams } from "react-router-dom";
import { Grid, TextField, FormControl,FormLabel,Button} from "@mui/material";

import Event,{EventContext} from '../Event';

/**
 * 履歴からバインダーの選択を行う
 * @param {*} props 
 * @returns 
 */
function Commit(props) {

  const evt = useContext(EventContext)
  const [comment, setComment] = useState("Updated:");
  const {date} = useParams();

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

  var rowNum = comment.split("\n").length + 1;
  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Commit Comment</FormLabel>
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
        <Button variant="contained" onClick={handleCommit}>Commit</Button>
       </FormControl>
    </Grid>
  </>);
}
export default Commit;