import { useEffect, useState, useContext } from "react";

import { Box, FormControl, FormLabel, IconButton, TextField } from "@mui/material";
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="formGrid" style={{ margin: '20px 24px', flex: 1 }}>
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
      </div>

      {/** 保存 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <IconButton onClick={handleSave} aria-label="save" sx={{ color: 'var(--accent-blue)' }}>
          <SaveIcon fontSize="large" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default GitSetting;
