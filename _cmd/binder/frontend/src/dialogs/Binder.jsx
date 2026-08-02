import { useEffect, useState, useContext } from "react";

import {
  Box, FormControl, FormControlLabel, FormLabel, List, ListItemButton, ListItemText, Switch, TextField, Typography,
} from "@mui/material";
import CheckIcon from '@mui/icons-material/Check';
import CircularProgress from '@mui/material/CircularProgress';
import AuthFields from "../components/AuthFields";
import { GetConfig, EditConfig, GetUserInfo, EditUserInfo, GetAllowedCDNs } from "../../bindings/binder/api/app";
import PluginSetting from "./PluginSetting";
import RootFileSetting from "./RootFileSetting";
import MarkedScript from "../components/editor/engines/Marked";
import MermaidScript from "../components/editor/engines/Mermaid";
import Scripter from "../components/editor/engines/Scripter";

import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

// スクリプトとプラグインは関連が近いため隣り合わせにする
const MENU_ITEMS_KEYS = [
  { key: "basic", labelKey: "setting.basic" },
  { key: "userinfo", labelKey: "binder.userInfo" },
  { key: "script", labelKey: "binder.script" },
  { key: "plugin", labelKey: "plugin.title" },
  { key: "rootfile", labelKey: "rootFile.title" },
];

/**
 * バインダーのメタデータを表示・編集
 */
function Binder({ isModal, ...props }) {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const {t} = useTranslation();

  // CDN URL から "pkg@x.y.z" のバージョンを読み取る（読み取れなければ null）
  const cdnVersion = (url, pkg) => {
    const m = String(url || "").match(new RegExp(pkg + "@(\\d+\\.\\d+\\.\\d+)"));
    return m ? m[1] : null;
  };

  // バンドル版（未指定時に動作する版）と、CDN指定時のバージョン表記を出す。
  //
  // 表示は「URL に何と書いてあるか」ではなく「実際に何が動いているか」を優先する。
  // CDN 指定はバージョン固定の手段として使われるため、読み込みに失敗してベンダー版へ
  // 落ちているのに URL 由来の版を表示すると、固定できているように見えてしまう。
  //
  // applied は現在動作中の解決結果（保存済みURLに対するもののみ渡す）。
  //   - applied.source === 'cdn' … 実際に読めている。version があればそれ、無ければ
  //     機能プローブの判定（marked はランタイムに version を公開しないため）
  //   - applied.source === 'vendor' … 読めずにベンダー版で動作中（失敗として赤字で出す）
  //   - applied なし（未保存の編集中など）… URL の記載から読み取れる版を参考表示する
  const renderVersionInfo = (bundled, url, pkg, applied) => {
    let cdnText = null;
    let failed = false;

    if (url) {
      if (applied && applied.source === 'vendor') {
        cdnText = t("binder.versionCdnFallback");
        failed = true;
      } else if (applied && applied.version) {
        cdnText = t("binder.versionCdn", { version: applied.version });
      } else if (applied && applied.major != null) {
        cdnText = t("binder.versionCdnDetected", { version: "v" + applied.major });
      } else {
        const cdn = cdnVersion(url, pkg);
        cdnText = cdn
          ? t("binder.versionCdnPending", { version: cdn })
          : t("binder.versionCdnUnknown");
      }
    }

    return (
      <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontSize: '11px', mt: 0.5, textAlign: 'left' }}>
        {t("binder.versionDefault", { version: bundled || "?" })}
        {cdnText && " / "}
        {cdnText && <Box component="span" sx={failed ? { color: 'var(--accent-red)' } : undefined}>{cdnText}</Box>}
      </Typography>
    );
  };

  const [activeSection, setActiveSection] = useState("basic");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [markedUrl, setMarkedUrl] = useState("");
  const [mermaidUrl, setMermaidUrl] = useState("");
  // 現在動作している marked の判定結果（機能プローブ含む）と、開いた時点の保存済みURL。
  // 編集中の未保存URLに対して古い判定を表示しないよう savedMarkedUrl と一致する時だけ使う。
  const [markedInfo, setMarkedInfo] = useState(null);
  const [savedMarkedUrl, setSavedMarkedUrl] = useState("");
  const [optimizeImage, setOptimizeImage] = useState(true);
  const [colorSchemeAttr, setColorSchemeAttr] = useState("");
  const [colorSchemeValues, setColorSchemeValues] = useState("");
  const [scriptSaving, setScriptSaving] = useState(false);
  const [markedStatus, setMarkedStatus] = useState("");  // "", "ok", "error"
  const [mermaidStatus, setMermaidStatus] = useState(""); // "", "ok", "error"

  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  // 認証情報
  const [authType, setAuthType] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authPassphrase, setAuthPassphrase] = useState("");
  const [authSSHKey, setAuthSSHKey] = useState("");

  useEffect(() => {
    if (!isModal) evt.changeTitle(t("binder.editTitle"));
    GetConfig().then((conf) => {
      setName(conf.name);
      setDetail(conf.detail);
      setMarkedUrl(conf.markedUrl || "");
      setMermaidUrl(conf.mermaidUrl || "");
      setSavedMarkedUrl(conf.markedUrl || "");
      setOptimizeImage(conf.optimizeImage !== false);
      if (conf.previewColorScheme) {
        setColorSchemeAttr(conf.previewColorScheme.attribute || "");
        setColorSchemeValues((conf.previewColorScheme.values || []).join(", "));
      }
    }).catch((err) => {
      showError(err);
    });
    GetUserInfo().then((info) => {
      setGitName(info.name || "");
      setGitMail(info.email || "");
      setAuthType(info.auth_type || "");
      setAuthUsername(info.username || "");
      setAuthPassword(info.password || "");
      setAuthToken(info.token || "");
      setAuthPassphrase(info.passphrase || "");
      if (info.bytes) {
        const decoder = new TextDecoder();
        setAuthSSHKey(decoder.decode(new Uint8Array(info.bytes)));
      } else {
        setAuthSSHKey("");
      }
    }).catch((err) => {
      showError(err);
    });
  }, []);

  // marked を初期化し、現在動作している版（機能プローブ含む）を取得する。
  // CDN 指定で URL からバージョンが読み取れない場合の「vN と判断」表示に使う。
  useEffect(() => {
    let alive = true;
    MarkedScript.ensureInit()
      .then(() => { if (alive) setMarkedInfo(MarkedScript.getMarkedInfo()); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleSave = () => {
    const values = colorSchemeValues.split(",").map(v => v.trim()).filter(v => v);
    const previewColorScheme = colorSchemeAttr && values.length > 0
      ? { attribute: colorSchemeAttr, values }
      : null;
    const config = { name, detail, markedUrl, mermaidUrl, optimizeImage, previewColorScheme };
    EditConfig(config).then(() => {
      evt.changeBinderTitle(name);
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      showError(err);
    });
  };

  const handleSaveScript = async () => {
    setScriptSaving(true);
    setMarkedStatus("");
    setMermaidStatus("");
    try {
      // ホワイトリストを取得
      let allowedDomains = [];
      try {
        allowedDomains = await GetAllowedCDNs() || [];
      } catch (e) {}

      const values = colorSchemeValues.split(",").map(v => v.trim()).filter(v => v);
      const previewColorScheme = colorSchemeAttr && values.length > 0
        ? { attribute: colorSchemeAttr, values }
        : null;
      const config = { name, detail, markedUrl, mermaidUrl, previewColorScheme };
      await EditConfig(config);
      // 保存済みURLを更新し、直後のバージョン表示が「判定結果」を反映できるようにする
      setSavedMarkedUrl(markedUrl);

      // marked の検証と差し替え。
      // loadAndValidate はエンジン実体を差し替えるだけでプラグインを再適用しないため、
      // 検証後に必ず reset() → ensureInit() で init 経路（バージョン解決 + プラグイン適用）を
      // やり直す。これを省くとプラグインが一本も効かないままプレビュー・出力が動いてしまう。
      if (markedUrl) {
        if (!Scripter.isAllowedUrl(markedUrl, allowedDomains)) {
          setMarkedStatus("error");
        } else {
          const result = await MarkedScript.loadAndValidate(markedUrl);
          setMarkedStatus(result.success ? "ok" : "error");
        }
      } else {
        setMarkedStatus("");
      }
      MarkedScript.reset();
      await MarkedScript.ensureInit().catch(() => {});
      setMarkedInfo(MarkedScript.getMarkedInfo());

      // mermaid の検証と差し替え
      if (mermaidUrl) {
        if (!Scripter.isAllowedUrl(mermaidUrl, allowedDomains)) {
          setMermaidStatus("error");
        } else {
          const result = await MermaidScript.loadAndValidate(mermaidUrl);
          setMermaidStatus(result.success ? "ok" : "error");
        }
      } else {
        MermaidScript.reset();
        setMermaidStatus("");
      }

      evt.showSuccessMessage(t("binder.updateSuccess"));
    } catch (err) {
      showError(err);
    } finally {
      setScriptSaving(false);
    }
  };

  const handleSaveUserInfo = () => {
    EditUserInfo({
      name: gitName, email: gitMail,
      auth_type: authType, username: authUsername, password: authPassword,
      token: authToken, passphrase: authPassphrase, filename: '',
      bytes: Array.from(new TextEncoder().encode(authSSHKey)),
    }).then(() => {
      evt.showSuccessMessage(t("binder.updateSuccess"));
    }).catch((err) => {
      showError(err);
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** 左サイドナビ */}
      <List disablePadding sx={{
        width: 120,
        flexShrink: 0,
        borderRight: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-dialog)',
        pt: 1,
      }}>
        {MENU_ITEMS_KEYS.map((item) => (
          <ListItemButton
            key={item.key}
            selected={activeSection === item.key}
            onClick={() => setActiveSection(item.key)}
            sx={{
              py: 1,
              px: 1.5,
              '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
              '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
              '&:hover': { backgroundColor: 'var(--bg-elevated)' },
            }}
          >
            <ListItemText
              primary={t(item.labelKey)}
              primaryTypographyProps={{ fontSize: '13px' }}
            />
          </ListItemButton>
        ))}
      </List>

      {/** 右コンテンツ */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {activeSection === "basic" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            <FormControl>
              <FormLabel>{t("common.name")}</FormLabel>
              <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>{t("common.detail")}</FormLabel>
              <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
            </FormControl>

            <FormControlLabel
              control={
                <Switch checked={optimizeImage} onChange={(e) => setOptimizeImage(e.target.checked)} size="small" />
              }
              label={t("binder.optimizeImage")}
              sx={{
                mt: 1,
                ml: 0.5,
                '& .MuiFormControlLabel-label': { fontSize: '13px', color: 'var(--text-primary)' },
              }}
            />

            <Box sx={{ borderTop: '1px solid var(--border-subtle)', pt: 2, mt: 1 }}>
              <FormLabel sx={{ mb: 0, display: 'block' }}>{t("binder.previewColorScheme")}</FormLabel>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mb: 1 }}>
                {t("binder.previewColorSchemeHint")}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel sx={{ fontSize: '12px' }}>{t("binder.previewColorSchemeAttr")}</FormLabel>
                  <TextField size="small" value={colorSchemeAttr} onChange={(e) => setColorSchemeAttr(e.target.value)}
                    placeholder="data-theme" />
                </FormControl>
                <FormControl sx={{ flex: 2 }}>
                  <FormLabel sx={{ fontSize: '12px' }}>{t("binder.previewColorSchemeValues")}</FormLabel>
                  <TextField size="small" value={colorSchemeValues} onChange={(e) => setColorSchemeValues(e.target.value)}
                    placeholder="light, dark" />
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleSave} />
            </Box>

          </div>
        )}

        {activeSection === "script" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            <FormControl>
              <FormLabel>{t("binder.markedUrl")}</FormLabel>
              <TextField
                size="small"
                value={markedUrl}
                onChange={(e) => { setMarkedUrl(e.target.value); setMarkedStatus(""); }}
                placeholder="https://cdn.jsdelivr.net/npm/marked@14.1.4/lib/marked.esm.js"
                helperText={
                  markedStatus === "ok" ? t("binder.cdnOk") :
                  markedStatus === "error" ? t("binder.cdnLoadError") :
                  t("binder.cdnHint")
                }
                error={markedStatus === "error"}
                color={markedStatus === "ok" ? "success" : undefined}
                focused={markedStatus === "ok"}
                FormHelperTextProps={{ sx: markedStatus === "" ? { color: 'var(--text-muted)' } : {} }}
              />
              {renderVersionInfo(
                MarkedScript.getVendorVersion(),
                markedUrl,
                "marked",
                // 編集中で未保存の URL には現在の解決結果は対応しないため渡さない
                (markedUrl === savedMarkedUrl) ? markedInfo : null,
              )}
            </FormControl>

            <FormControl>
              <FormLabel>{t("binder.mermaidUrl")}</FormLabel>
              <TextField
                size="small"
                value={mermaidUrl}
                onChange={(e) => { setMermaidUrl(e.target.value); setMermaidStatus(""); }}
                placeholder="https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs"
                helperText={
                  mermaidStatus === "ok" ? t("binder.cdnOk") :
                  mermaidStatus === "error" ? t("binder.cdnLoadError") :
                  t("binder.cdnHint")
                }
                error={mermaidStatus === "error"}
                color={mermaidStatus === "ok" ? "success" : undefined}
                focused={mermaidStatus === "ok"}
                FormHelperTextProps={{ sx: mermaidStatus === "" ? { color: 'var(--text-muted)' } : {} }}
              />
              {renderVersionInfo(MermaidScript.getVendorVersion(), mermaidUrl, "mermaid", null)}
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 2 }}>
              {scriptSaving && <CircularProgress size={24} />}
              <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleSaveScript} disabled={scriptSaving} />
            </Box>

          </div>
        )}

        {activeSection === "plugin" && (
          <PluginSetting />
        )}

        {activeSection === "rootfile" && (
          <RootFileSetting />
        )}

        {activeSection === "userinfo" && (
          <div className="formGrid" style={{ margin: '20px 24px', padding: '8px' }}>

            {/** 記録者として残す情報。バインダーごとに保持する */}
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mb: 1 }}>
              {t("binder.userInfoHint")}
            </Typography>

            {/** ユーザ情報 */}
            <FormControl>
              <FormLabel>{t("binder.userName")}</FormLabel>
              <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>{t("binder.userEmail")}</FormLabel>
              <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
            </FormControl>

            {/** 認証情報 */}
            <AuthFields
              authType={authType} onAuthTypeChange={setAuthType}
              username={authUsername} onUsernameChange={setAuthUsername}
              password={authPassword} onPasswordChange={setAuthPassword}
              token={authToken} onTokenChange={setAuthToken}
              passphrase={authPassphrase} onPassphraseChange={setAuthPassphrase}
              sshKey={authSSHKey} onSSHKeyChange={setAuthSSHKey}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleSaveUserInfo} />
            </Box>

          </div>
        )}

      </Box>

    </Box>
  );
}

export default Binder;
