import { useEffect, useState } from "react";
import { Grid, TextField, FormControl,FormLabel,Button} from "@mui/material";

import Event from '../Event';
import Message from '../Message';

/**
 * 履歴からバインダーの選択を行う
 * @param {*} props 
 * @returns 
 */
function Commit(props) {

  const [comment, setComment] = useState("Updated:");

  useEffect(() => {
    Event.register(Event.ModifiedComment,function(comment) {
      setComment(comment);
    })
  }, [])

  //保存
  const handleCommit = () => {
    //イベントでツリー側で処理
    Event.raise(Event.ModifiedCommit,comment);
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