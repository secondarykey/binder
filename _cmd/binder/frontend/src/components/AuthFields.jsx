import { FormControl, FormLabel, MenuItem, Select, TextField } from "@mui/material";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

const AUTH_TYPES = [
  { value: 'basic', labelKey: 'push.authBasic' },
  { value: 'token', labelKey: 'push.authToken' },
  { value: 'ssh_file', labelKey: 'push.authSSHFile' },
  { value: 'ssh_agent', labelKey: 'push.authSSHAgent' },
];

/**
 * 認証情報入力フィールド（共通コンポーネント）
 *
 * props:
 *   authType, onAuthTypeChange,
 *   username, onUsernameChange,
 *   password, onPasswordChange,
 *   token, onTokenChange,
 *   passphrase, onPassphraseChange,
 *   filename, onFilenameChange,
 */
function AuthFields({
  authType, onAuthTypeChange,
  username, onUsernameChange,
  password, onPasswordChange,
  token, onTokenChange,
  passphrase, onPassphraseChange,
  filename, onFilenameChange,
}) {
  const { t } = useTranslation();

  return (<>
    <FormControl size="small">
      <FormLabel>{t("push.authType")}</FormLabel>
      <Select
        value={authType}
        onChange={(e) => onAuthTypeChange(e.target.value)}
        size="small"
      >
        <MenuItem value="">&nbsp;</MenuItem>
        {AUTH_TYPES.map((at) => (
          <MenuItem key={at.value} value={at.value}>{t(at.labelKey)}</MenuItem>
        ))}
      </Select>
    </FormControl>

    {/* Basic認証フィールド */}
    {authType === 'basic' && (
      <>
        <FormControl size="small">
          <FormLabel>{t('push.username')}</FormLabel>
          <TextField size="small" value={username} onChange={(e) => onUsernameChange(e.target.value)} />
        </FormControl>
        <FormControl size="small">
          <FormLabel>{t('push.password')}</FormLabel>
          <TextField size="small" type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} />
        </FormControl>
      </>
    )}

    {/* トークン認証フィールド */}
    {authType === 'token' && (
      <FormControl size="small">
        <FormLabel>{t('push.token')}</FormLabel>
        <TextField size="small" type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} />
      </FormControl>
    )}

    {/* SSH鍵ファイルフィールド */}
    {authType === 'ssh_file' && (
      <>
        <FormControl size="small">
          <FormLabel>{t('push.filename')}</FormLabel>
          <TextField size="small" value={filename} onChange={(e) => onFilenameChange(e.target.value)} />
        </FormControl>
        <FormControl size="small">
          <FormLabel>{t('push.passphrase')}</FormLabel>
          <TextField size="small" type="password" value={passphrase} onChange={(e) => onPassphraseChange(e.target.value)} />
        </FormControl>
      </>
    )}

    {/* SSHエージェント: 追加入力なし */}
  </>);
}

export default AuthFields;
