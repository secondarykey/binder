import { useEffect, useState, useContext } from "react";
import { Grid, TextField, FormControl, FormLabel, Button } from "@mui/material";

import Event, { EventContext } from '../Event';

/**
 * Generateフォーム（PublishModalの右パネル）
 * CommitのCommit.jsx と同じ構造で、
 * PublishComment イベントでコメントを受け取り、
 * Generate ボタン押下で PublishGenerate イベントを発火する。
 */
function GenerateForm({ date }) {

  const evt = useContext(EventContext);
  const [comment, setComment] = useState("Generate:");

  useEffect(() => {
    evt.register("GenerateForm", Event.PublishComment, function (c) {
      setComment(c);
    });
  }, [date]);

  const handleGenerate = () => {
    evt.raise(Event.PublishGenerate, comment);
  };

  const rowNum = Math.min(comment.split("\n").length + 1, 10);

  return (
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Generate Comment</FormLabel>
        <TextField
          multiline={true}
          rows={rowNum}
          value={comment}
          style={{ minWidth: "500px" }}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleGenerate}>Generate</Button>
      </FormControl>

    </Grid>
  );
}

export default GenerateForm;
