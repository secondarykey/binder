import { useEffect, useState, useContext } from "react";
import { Grid, TextField, FormControl, FormLabel, Button, LinearProgress, Typography } from "@mui/material";

import Event, { EventContext } from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * Generateフォーム（PublishModalの右パネル）
 * CommitのCommit.jsx と同じ構造で、
 * PublishComment イベントでコメントを受け取り、
 * Generate ボタン押下で PublishGenerate イベントを発火する。
 */
function GenerateForm({ date, template }) {

  const evt = useContext(EventContext);
  const {t} = useTranslation();
  const [comment, setComment] = useState("Generate:");
  const [progress, setProgress] = useState({ running: false, current: 0, total: 0 });

  useEffect(() => {
    evt.register("GenerateForm", Event.PublishComment, function (c) {
      setComment(c);
    });
    evt.register("GenerateForm", Event.PublishProgress, function (p) {
      setProgress(p);
    });
  }, [date]);

  const handleGenerate = () => {
    evt.raise(Event.PublishGenerate, comment);
  };

  const rowNum = Math.min(comment.split("\n").length + 1, 10);

  return (
    <Grid className="formGrid">

      {template && (
        <Typography variant="body2" sx={{ mx: 1, mb: 1, color: 'var(--text-secondary)' }}>
          {t("template.batchPublishNotice")}
        </Typography>
      )}

      <FormControl>
        <FormLabel>{t("publishModal.generateComment")}</FormLabel>
        <TextField
          multiline={true}
          rows={rowNum}
          value={comment}
          style={{ minWidth: "500px" }}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormControl>

      {progress.running && (
        <LinearProgress
          variant="determinate"
          value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
          sx={{ mx: 1 }}
        />
      )}

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={handleGenerate} disabled={progress.running}>{t("publishModal.generate")}</Button>
      </FormControl>

    </Grid>
  );
}

export default GenerateForm;
