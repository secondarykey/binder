import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, TextField, IconButton } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';

import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * エディタ設定（テキスト入力）
 */
function EditorSetting() {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [editorProgram, setEditorProgram] = useState("notepad {file}");

  useEffect(() => {
    // TODO: エディタ設定の読み込みAPI実装時に接続
  }, []);

  const handleSave = () => {
    // TODO: エディタ設定の保存API実装時に接続
    evt.showSuccessMessage(t("common.updated"));
  };

  return (
    <div className="formGrid" style={{ margin: '20px 24px' }}>
      <div className="formContainer">
        {/** エディタパス */}
        <FormControl>
          <FormLabel>{t("setting.editorProgram")}</FormLabel>
          <TextField size="small" value={editorProgram} onChange={(e) => setEditorProgram(e.target.value)} />
        </FormControl>
      </div>

      {/** 保存 */}
      <IconButton className="saveBtn" onClick={handleSave} aria-label="save">
        <SaveIcon fontSize="large" color="primary" />
      </IconButton>
    </div>
  );
}

export default EditorSetting;
