import { useEffect, useState, useContext, useRef } from "react";
import { Events } from '@wailsio/runtime';

import { Box, Button, FormControl, FormControlLabel, FormLabel, IconButton, Switch, TextField } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import FontDownloadIcon from '@mui/icons-material/FontDownload';

import { GetEditor, SaveEditor, GetFont, SaveFont } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';
import FontDialog from "./FontDialog";

/**
 * エディタ設定（テキスト入力）
 */
function EditorSetting() {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [editorProgram, setEditorProgram] = useState("");
  const [gitBash, setGitBash] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [programError, setProgramError] = useState(false);
  const editorBaseRef = useRef(null);

  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const [font, setFont] = useState(undefined);

  useEffect(() => {
    GetEditor().then((e) => {
      if (e) {
        editorBaseRef.current = e;
        setEditorProgram(e.program || "");
        setGitBash(e.gitbash || false);
        setShowLineNumbers(e.showLineNumbers);
        setWordWrap(e.wordWrap);
        setShowPreview(e.showPreview);
      }
    }).catch((err) => {
      console.log(err);
    });

    GetFont().then((f) => {
      if (f) {
        setFont(f);
      }
    }).catch((err) => {
      console.log(err);
    });

    // エディタ側からの設定変更を同期
    const cleanupSetting = Events.On('binder:editor:settingChanged', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      if (data.showLineNumbers !== undefined) setShowLineNumbers(data.showLineNumbers);
      if (data.wordWrap !== undefined) setWordWrap(data.wordWrap);
      if (data.showPreview !== undefined) setShowPreview(data.showPreview);
    });

    // エディタ側からのフォント変更を同期
    const cleanupFont = Events.On('binder:editor:fontChanged', (event) => {
      const f = event.data?.[0] ?? event.data ?? {};
      if (f) setFont(f);
    });

    return () => { cleanupSetting(); cleanupFont(); };
  }, []);

  const handleProgramChange = (e) => {
    const val = e.target.value;
    setEditorProgram(val);
    if (val && !val.includes("{file}")) {
      setProgramError(true);
    } else {
      setProgramError(false);
    }
  };

  const handleSave = () => {
    if (editorProgram && !editorProgram.includes("{file}")) {
      setProgramError(true);
      return;
    }
    const editor = {
      ...editorBaseRef.current,
      program: editorProgram,
      gitbash: gitBash,
      showLineNumbers: showLineNumbers,
      wordWrap: wordWrap,
      showPreview: showPreview,
    };
    SaveEditor(editor).then(() => {
      evt.showSuccessMessage(t("common.updated"));
      // エディタ側のstateを同期
      Events.Emit('binder:editor:settingChanged', { showLineNumbers, wordWrap, showPreview });
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleFontDialogClose = (result) => {
    setFontDialogOpen(false);
    if (result) {
      setFont(result);
      SaveFont(result).then(() => {
        Events.Emit('binder:editor:fontChanged', result);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="formGrid" style={{ margin: '20px 24px', flex: 1 }}>
        <div className="formContainer">

          {/** フォント設定ボタン */}
          <FormControl>
            <Button
              variant="outlined"
              startIcon={<FontDownloadIcon />}
              onClick={() => setFontDialogOpen(true)}
              sx={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            >
              {t("setting.fontSetting")}
            </Button>
          </FormControl>

          {/** 行番号表示 */}
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={showLineNumbers}
                  onChange={(e) => setShowLineNumbers(e.target.checked)}
                />
              }
              label={t("setting.showLineNumbers")}
            />
          </FormControl>

          {/** テキスト折り返し */}
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                />
              }
              label={t("setting.wordWrap")}
            />
          </FormControl>

          {/** プレビュー表示 */}
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                />
              }
              label={t("setting.showPreview")}
            />
          </FormControl>

          {/** エディタプログラム */}
          <FormControl>
            <FormLabel>{t("setting.editorProgram")}</FormLabel>
            <TextField
              size="small"
              value={editorProgram}
              onChange={handleProgramChange}
              error={programError}
              helperText={programError ? t("setting.editorProgramError") : ""}
            />
          </FormControl>

          {/** Git Bash */}
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={gitBash}
                  onChange={(e) => setGitBash(e.target.checked)}
                />
              }
              label={t("setting.gitBash")}
            />
          </FormControl>

        </div>
      </div>

      {/** 保存 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <IconButton onClick={handleSave} aria-label="save" sx={{ '& svg': { fill: 'var(--accent-blue)' } }}>
          <SaveIcon fontSize="large" />
        </IconButton>
      </Box>

      {/** フォントダイアログ */}
      <FontDialog show={fontDialogOpen} font={font} onClose={handleFontDialogClose} />
    </Box>
  );
}

export default EditorSetting;
