import { useEffect, useState, useContext, useRef } from "react";
import { Events } from '@wailsio/runtime';

import { Box, Button, FormControl, FormControlLabel, FormLabel, InputAdornment, Switch, TextField } from "@mui/material";
import TerminalIcon from '@mui/icons-material/Terminal';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import CheckIcon from '@mui/icons-material/Check';

import { GetEditor, SaveEditor, GetFont, SaveFont } from "../../bindings/binder/api/app";
import { SelectFile } from "../../bindings/main/window";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
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
  const [autoComplete, setAutoComplete] = useState({
    template: true, idAssist: true, autoClose: true, funcHint: true, mermaid: true,
  });
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
        if (e.autoComplete && typeof e.autoComplete === 'object') {
          setAutoComplete(e.autoComplete);
        } else {
          const v = e.autoComplete !== false;
          setAutoComplete({ template: v, idAssist: v, autoClose: v, funcHint: v, mermaid: v });
        }
      }
    }).catch((err) => {
      console.log(err);
    });

    GetFont(document.documentElement.dataset.theme || 'dark').then((f) => {
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
      if (data.autoComplete !== undefined) {
        if (typeof data.autoComplete === 'object') {
          setAutoComplete(data.autoComplete);
        }
      }
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
      autoComplete: autoComplete,
    };
    SaveEditor(editor).then(() => {
      evt.showSuccessMessage(t("common.updated"));
      // エディタ側のstateを同期
      Events.Emit('binder:editor:settingChanged', { showLineNumbers, wordWrap, showPreview, autoComplete });
    }).catch((err) => {
      showError(err);
    });
  };

  const handleFontDialogClose = (result) => {
    setFontDialogOpen(false);
    if (result) {
      setFont(result);
      SaveFont(document.documentElement.dataset.theme || 'dark', result).then(() => {
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
              size="small"
              startIcon={<FontDownloadIcon />}
              onClick={() => setFontDialogOpen(true)}
              sx={{
                width: 'fit-content',
                fontSize: '13px',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-input)',
                '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' },
              }}
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

          {/** オートコンプリート */}
          <FormControl>
            <FormLabel sx={{ mb: 0.5 }}>{t("setting.autoComplete")}</FormLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 1 }}>
              {[
                { key: 'template', label: 'setting.ac.template' },
                { key: 'idAssist', label: 'setting.ac.idAssist' },
                { key: 'autoClose', label: 'setting.ac.autoClose' },
                { key: 'funcHint', label: 'setting.ac.funcHint' },
                { key: 'mermaid', label: 'setting.ac.mermaid' },
              ].map(({ key, label }) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      size="small"
                      checked={autoComplete[key] ?? true}
                      onChange={(e) => setAutoComplete(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                  }
                  label={t(label)}
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
                />
              ))}
            </Box>
          </FormControl>

          {/** エディタプログラム */}
          <FormControl>
            <FormLabel>{t("setting.editorProgram")}</FormLabel>
            <TextField
              size="small"
              value={editorProgram}
              onClick={handleSelectProgram}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <TerminalIcon sx={{ color: 'var(--text-muted)', fontSize: '20px' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ cursor: 'pointer', '& input': { cursor: 'pointer' } }}
            />
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
              FormHelperTextProps={{ sx: argsError ? {} : { color: 'var(--text-muted)' } }}
            />
          </FormControl>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
            {t("setting.editorExample")}
          </p>

        </div>
      </div>

      {/** 保存 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleSave} />
      </Box>

      {/** フォントダイアログ */}
      <FontDialog show={fontDialogOpen} font={font} onClose={handleFontDialogClose} />
    </Box>
  );
}

export default EditorSetting;
