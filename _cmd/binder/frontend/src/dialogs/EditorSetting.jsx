import { useEffect, useState, useContext, useRef } from "react";
import { Events } from '@wailsio/runtime';

import { Box, Button, FormControl, FormControlLabel, FormLabel, IconButton, Switch, TextField } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import FontDownloadIcon from '@mui/icons-material/FontDownload';

import { GetEditor, SaveEditor, GetFont, SaveFont } from "../../bindings/binder/api/app";
import { SelectFile } from "../../bindings/main/window";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import "../language";
import { useTranslation } from 'react-i18next';
import FontDialog from "./FontDialog";

/**
 * エディタ設定（テキスト入力）
 */
function EditorSetting() {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const {t} = useTranslation();

  const [editorProgram, setEditorProgram] = useState("");
  const [editorArgs, setEditorArgs] = useState("{file}");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [argsError, setArgsError] = useState(false);
  const editorBaseRef = useRef(null);

  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const [font, setFont] = useState(undefined);

  useEffect(() => {
    GetEditor().then((e) => {
      if (e) {
        editorBaseRef.current = e;
        setEditorProgram(e.program || "");
        setEditorArgs(e.args || "{file}");
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

  const handleSelectProgram = () => {
    SelectFile("Executable Files", "*.exe;*").then((path) => {
      if (path) setEditorProgram(path);
    }).catch((err) => {
      showError(err);
    });
  };

  const hasFileMark = (val) => val.includes("{file}") || val.includes("{bfile}");

  const handleArgsChange = (e) => {
    const val = e.target.value;
    setEditorArgs(val);
    setArgsError(val && !hasFileMark(val));
  };

  const handleSave = () => {
    if (editorArgs && !hasFileMark(editorArgs)) {
      setArgsError(true);
      return;
    }
    const editor = {
      ...editorBaseRef.current,
      program: editorProgram,
      args: editorArgs,
      showLineNumbers: showLineNumbers,
      wordWrap: wordWrap,
      showPreview: showPreview,
    };
    SaveEditor(editor).then(() => {
      evt.showSuccessMessage(t("common.updated"));
      // エディタ側のstateを同期
      Events.Emit('binder:editor:settingChanged', { showLineNumbers, wordWrap, showPreview });
    }).catch((err) => {
      showError(err);
    });
  };

  const handleFontDialogClose = (result) => {
    setFontDialogOpen(false);
    if (result) {
      setFont(result);
      SaveFont(result).then(() => {
        Events.Emit('binder:editor:fontChanged', result);
      }).catch((err) => {
        showError(err);
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                value={editorProgram}
                InputProps={{ readOnly: true }}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleSelectProgram}
                sx={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)', whiteSpace: 'nowrap' }}
              >
                {t("common.select")}
              </Button>
            </Box>
          </FormControl>

          {/** エディタ引数 */}
          <FormControl>
            <FormLabel>{t("setting.editorArgs")}</FormLabel>
            <TextField
              size="small"
              value={editorArgs}
              onChange={handleArgsChange}
              error={argsError}
              helperText={argsError ? t("setting.editorArgsError") : t("setting.editorArgsHint")}
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
