import { useState, useEffect, useContext } from "react";

import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, MenuItem, Select, TextField, Typography,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

import { GetPlugins, SavePlugin, RemovePlugin, RenamePlugin, ListAppPlugins, InstallAppPlugin, SetPluginVerifiedMajor, GetPluginVerifiedMajors } from "../../bindings/binder/api/app";
import { SelectJSFile } from "../../bindings/main/window";
import Marked from "../components/editor/engines/Marked";
import { parsePluginMeta, pluginCompatStatus } from "@shared/editor/pluginMeta";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

const ENGINES = [
  { value: "marked", labelKey: "plugin.engineMarkdown" },
];

const NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function PluginSetting() {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [engine, setEngine] = useState("marked");
  const [plugins, setPlugins] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [appPlugins, setAppPlugins] = useState([]);
  // 互換状態表示用: 現在の marked 情報とプラグイン検証時メジャー
  const [markedInfo, setMarkedInfo] = useState(null);
  const [verified, setVerified] = useState({});
  // 直近の適用結果（名前 → { applied, loadError, runtimeError }）。宣言だけでなく実測を表示するため
  const [runtime, setRuntime] = useState({});

  // 追加ダイアログ
  const [addDialog, setAddDialog] = useState(false);
  const [addName, setAddName] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addNameError, setAddNameError] = useState("");

  // リネームダイアログ
  const [renameDialog, setRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [renameName, setRenameName] = useState("");
  const [renameNameError, setRenameNameError] = useState("");

  // 削除確認ダイアログ
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");

  const loadPlugins = () => {
    // 互換状態を判定するため内容込みで取得する
    GetPlugins(engine).then((list) => {
      setPlugins(list || []);
    }).catch((err) => showError(err));
    GetPluginVerifiedMajors(engine).then((v) => setVerified(v || {})).catch(() => setVerified({}));
  };

  const loadAppPlugins = () => {
    ListAppPlugins(engine).then((list) => {
      setAppPlugins(list || []);
    }).catch(() => setAppPlugins([]));
  };

  useEffect(() => {
    loadPlugins();
    loadAppPlugins();
    setSelectedName(null);
  }, [engine]);

  // marked を初期化して現在のバージョン情報を取得する（互換状態表示用）
  useEffect(() => {
    let alive = true;
    Marked.ensureInit()
      .then(() => {
        if (!alive) return;
        setMarkedInfo(Marked.getMarkedInfo());
        setRuntime({ ...Marked.getPluginStatus() });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 現在動作している marked のメジャー（記録用）
  const currentMajor = () => (Marked.getMarkedInfo() || markedInfo || {}).major ?? null;

  // 保存したプラグインの検証時メジャーを記録する
  const recordVerified = (name) => {
    const major = currentMajor();
    if (major == null) return Promise.resolve();
    return SetPluginVerifiedMajor(engine, name, major).catch(() => {});
  };

  // プラグインの互換状態。
  // 宣言（@marked）と検証記録から求めた互換判定に、直近の実行結果を上書きする。
  // 宣言上は問題なくても実際には読み込めていない／例外を投げている場合があり、
  // それを表示しないと「設定画面は緑なのに動いていない」状態になる。
  const statusOf = (plugin) => {
    const meta = parsePluginMeta(plugin.content || "");
    const compat = pluginCompatStatus(meta, markedInfo, verified[plugin.name]);
    const rt = runtime[plugin.name];
    if (rt) {
      if (rt.loadError) return { meta, status: 'loadError', detail: rt.loadError };
      if (rt.runtimeError) return { meta, status: 'runtimeError', detail: rt.runtimeError };
      if (!rt.applied && compat !== 'incompatible') return { meta, status: 'notApplied' };
    }
    return { meta, status: compat };
  };

  // 状態 → 表示色（テーマ変数）
  const STATUS_COLOR = {
    compatible: 'var(--accent-green)',
    incompatible: 'var(--accent-red)',
    loadError: 'var(--accent-red)',
    runtimeError: 'var(--accent-red)',
    notApplied: 'var(--accent-red)',
    unverified: 'var(--accent-orange, #d18616)',
    unknown: 'var(--text-muted)',
    undeclared: 'var(--text-muted)',
  };

  // セカンダリラベルを出す（＝一覧を見ただけで異常と分かるべき）状態
  const SECONDARY_LABEL = {
    incompatible: "plugin.compat.incompatibleShort",
    loadError: "plugin.compat.loadErrorShort",
    runtimeError: "plugin.compat.runtimeErrorShort",
    notApplied: "plugin.compat.notAppliedShort",
    unverified: "plugin.compat.unverifiedShort",
  };

  // --- 追加 ---
  const handleOpenAddDialog = () => {
    SelectJSFile().then((info) => {
      if (!info) return;
      setAddName(info.name);
      setAddContent(info.content);
      setAddNameError("");
      setAddDialog(true);
    }).catch((err) => showError(err));
  };

  const validateName = (name, excludeName = null) => {
    if (!name.trim()) return t("plugin.nameRequired");
    if (!NAME_PATTERN.test(name)) return t("plugin.invalidName");
    const exists = plugins.some((p) => p.name === name && p.name !== excludeName);
    if (exists) return t("plugin.duplicateName");
    return "";
  };

  const handleAddConfirm = () => {
    const err = validateName(addName);
    if (err) { setAddNameError(err); return; }
    SavePlugin(engine, addName, addContent).then(() => {
      recordVerified(addName).finally(() => {
        evt.showSuccessMessage(t("plugin.addSuccess"));
        setAddDialog(false);
        loadPlugins();
        Marked.reset();
      });
    }).catch((err) => showError(err));
  };

  // --- 更新（ファイル再インポート）---
  const handleUpdate = (name) => {
    SelectJSFile().then((info) => {
      if (!info) return;
      SavePlugin(engine, name, info.content).then(() => {
        recordVerified(name).finally(() => {
          evt.showSuccessMessage(t("plugin.updateSuccess"));
          loadPlugins();
          Marked.reset();
        });
      }).catch((err) => showError(err));
    }).catch((err) => showError(err));
  };

  // --- リネーム ---
  const handleOpenRenameDialog = (name) => {
    setRenameTarget(name);
    setRenameName(name);
    setRenameNameError("");
    setRenameDialog(true);
  };

  const handleRenameConfirm = () => {
    const err = validateName(renameName, renameTarget);
    if (err) { setRenameNameError(err); return; }
    if (renameName === renameTarget) { setRenameDialog(false); return; }
    RenamePlugin(engine, renameTarget, renameName).then(() => {
      evt.showSuccessMessage(t("plugin.renameSuccess"));
      setRenameDialog(false);
      loadPlugins();
      Marked.reset();
    }).catch((err) => showError(err));
  };

  // --- 削除 ---
  const handleOpenDeleteDialog = (name) => {
    setDeleteTarget(name);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    RemovePlugin(engine, deleteTarget).then(() => {
      evt.showSuccessMessage(t("plugin.removeSuccess"));
      setDeleteDialog(false);
      if (selectedName === deleteTarget) setSelectedName(null);
      loadPlugins();
      Marked.reset();
    }).catch((err) => showError(err));
  };

  const handleInstall = (name) => {
    InstallAppPlugin(engine, name).then(() => {
      recordVerified(name).finally(() => {
        evt.showSuccessMessage(t("plugin.installSuccess"));
        loadPlugins();
        Marked.reset();
      });
    }).catch((err) => showError(err));
  };

  const inputSx = {
    fontSize: '13px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-dropdown)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-muted)' },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '20px 24px', flex: 1 }}>

        {/** タイプ選択 + 追加ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>{t("plugin.type")}</FormLabel>
            <Select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              size="small"
              sx={inputSx}
              MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
            >
              {ENGINES.map((e) => (
                <MenuItem key={e.value} value={e.value} sx={{ fontSize: '13px' }}>
                  {t(e.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ActionButton variant="save" icon={<AddIcon />} label={t("common.add")} onClick={handleOpenAddDialog} size="small" />
        </Box>

        {/** プラグイン一覧 */}
        <FormControl>
          {plugins.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 1, fontSize: '13px', textAlign: 'left' }}>
              {t("plugin.empty")}
            </Typography>
          ) : (
            <List dense disablePadding>
              {plugins.map((p) => {
                const { meta, status, detail } = statusOf(p);
                const rangeText = meta.marked ? `marked ${meta.marked}` : t("plugin.compat.undeclaredRange");
                const tip = `${t("plugin.compat." + status)}${markedInfo ? ` / ${t("plugin.compat.current")}: ${markedInfo.version || markedInfo.major || '?'}` : ''}\n${rangeText}${detail ? `\n${detail}` : ''}`;
                return (
                <ListItemButton
                  key={p.name}
                  selected={selectedName === p.name}
                  onClick={() => setSelectedName(p.name)}
                  sx={{
                    py: 0.5,
                    textAlign: 'left',
                    '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
                    '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
                    '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                  }}
                >
                  <Box title={tip} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                    <Box component="span" sx={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: STATUS_COLOR[status] || 'var(--text-muted)',
                    }} />
                    <ListItemText
                      primary={p.name}
                      secondary={SECONDARY_LABEL[status] ? t(SECONDARY_LABEL[status]) : undefined}
                      primaryTypographyProps={{ fontSize: '13px', textAlign: 'left' }}
                      secondaryTypographyProps={{ fontSize: '11px', sx: { color: STATUS_COLOR[status] } }}
                    />
                  </Box>
                  <ListItemIcon sx={{ minWidth: 'auto', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      title={t("plugin.update")}
                      onClick={(e) => { e.stopPropagation(); handleUpdate(p.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <UploadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.rename")}
                      onClick={(e) => { e.stopPropagation(); handleOpenRenameDialog(p.name); }}
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      <DriveFileRenameOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title={t("common.delete")}
                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(p.name); }}
                      sx={{ '& svg': { fill: 'var(--accent-red)' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemIcon>
                </ListItemButton>
                );
              })}
            </List>
          )}
        </FormControl>

        {/** アプリプラグインからのインストール */}
        {appPlugins.length > 0 && (
          <FormControl>
            <FormLabel sx={{ mb: 1 }}>{t("plugin.appPlugins")}</FormLabel>
            <List dense disablePadding>
              {appPlugins.map((p) => {
                const installed = plugins.some((bp) => bp.name === p.name);
                return (
                  <ListItemButton
                    key={p.name}
                    disableRipple
                    sx={{
                      py: 0.5,
                      textAlign: 'left',
                      cursor: 'default',
                      '&:hover': { backgroundColor: 'transparent' },
                    }}
                  >
                    <ListItemText
                      primary={p.name}
                      primaryTypographyProps={{
                        fontSize: '13px',
                        color: installed ? 'var(--text-muted)' : 'var(--text-primary)',
                      }}
                    />
                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                      {installed ? (
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontSize: '11px', px: 1 }}>
                          {t("plugin.alreadyInstalled")}
                        </Typography>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => handleInstall(p.name)}
                          sx={{ fontSize: '11px', color: 'var(--accent-green)', minWidth: 'auto', px: 1 }}
                        >
                          {t("plugin.install")}
                        </Button>
                      )}
                    </ListItemIcon>
                  </ListItemButton>
                );
              })}
            </List>
          </FormControl>
        )}

      </Box>

      {/** 追加ダイアログ */}
      <Dialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.add")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("plugin.nameLabel")}
            placeholder={t("plugin.namePlaceholder")}
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddNameError(""); }}
            error={!!addNameError}
            helperText={addNameError}
            size="small"
            fullWidth
            margin="dense"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddConfirm(); } }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setAddDialog(false)} />
          <ActionButton variant="save" label={t("common.add")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleAddConfirm} />
        </DialogActions>
      </Dialog>

      {/** リネームダイアログ */}
      <Dialog
        open={renameDialog}
        onClose={() => setRenameDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)', minWidth: 320 } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.renameTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("plugin.nameLabel")}
            value={renameName}
            onChange={(e) => { setRenameName(e.target.value); setRenameNameError(""); }}
            error={!!renameNameError}
            helperText={renameNameError}
            size="small"
            fullWidth
            margin="dense"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameConfirm(); } }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setRenameDialog(false)} />
          <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleRenameConfirm} />
        </DialogActions>
      </Dialog>

      {/** 削除確認ダイアログ */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        PaperProps={{ style: { backgroundColor: 'var(--bg-button)' } }}
      >
        <DialogTitle style={{ color: 'var(--text-secondary)' }}>{t("plugin.deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {t("plugin.deleteConfirm", { name: deleteTarget })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setDeleteDialog(false)} />
          <ActionButton variant="delete" label={t("common.delete")} icon={<DeleteIcon />} onClick={handleDeleteConfirm} />
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default PluginSetting;
