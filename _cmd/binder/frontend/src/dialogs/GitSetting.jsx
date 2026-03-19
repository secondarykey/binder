import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, TextField, IconButton } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';

import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * Git設定
 */
function GitSetting() {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [gitBranch, setGitBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  useEffect(() => {
    // TODO: Git設定の読み込みAPI実装時に接続
  }, []);

  const handleSave = () => {
    // TODO: Git設定の保存API実装時に接続
    evt.showSuccessMessage(t("common.updated"));
  };

  return (
    <div className="formGrid" style={{ margin: '20px 24px' }}>
      <div className="formContainer">
        {/** デフォルトのブランチ名 */}
        <FormControl>
          <FormLabel>{t("setting.defaultBranch")}</FormLabel>
          <TextField size="small" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} />
        </FormControl>
        {/** ユーザ名 */}
        <FormControl>
          <FormLabel>{t("setting.gitName")}</FormLabel>
          <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
        </FormControl>
        {/** メールアドレス */}
        <FormControl>
          <FormLabel>{t("setting.gitMail")}</FormLabel>
          <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
        </FormControl>
      </div>

      {/** 保存 */}
      <IconButton className="saveBtn" onClick={handleSave} aria-label="save">
        <SaveIcon fontSize="large" color="primary" />
      </IconButton>
    </div>
  );
}

export default GitSetting;
