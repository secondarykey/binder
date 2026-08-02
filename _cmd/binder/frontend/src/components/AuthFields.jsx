import { Box, FormControl, FormLabel, MenuItem, Select, TextField } from "@mui/material";
import FileOpenIcon from '@mui/icons-material/FileOpen';
import { SelectFileContent } from "../../bindings/main/window";
import { ActionButton } from '../dialogs/components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

const AUTH_TYPES = [
  { value: 'basic', labelKey: 'share.authBasic' },
  { value: 'token', labelKey: 'share.authToken' },
  { value: 'ssh_key', labelKey: 'share.authSSHKey' },
  { value: 'ssh_agent', labelKey: 'share.authSSHAgent' },
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
 *   sshKey, onSSHKeyChange,
 */
function AuthFields({
  authType, onAuthTypeChange,
  username, onUsernameChange,
  password, onPasswordChange,
  token, onTokenChange,
  passphrase, onPassphraseChange,
  sshKey, onSSHKeyChange,
}) {
  const { t } = useTranslation();

  const handleLoadKeyFile = () => {
    SelectFileContent("SSH Key", "*").then((content) => {
      if (content) {
        onSSHKeyChange(content);
      }
    }).catch(() => {});
  };

  return (<>
    <FormControl size="small">
      <FormLabel>{t("share.authType")}</FormLabel>
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
          <FormLabel>{t('share.username')}</FormLabel>
          <TextField size="small" value={username} onChange={(e) => onUsernameChange(e.target.value)} />
        </FormControl>
        <FormControl size="small">
          <FormLabel>{t('share.password')}</FormLabel>
          <TextField size="small" type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} />
        </FormControl>
      </>
    )}

    {/* トークン認証フィールド */}
    {authType === 'token' && (
      <FormControl size="small">
        <FormLabel>{t('share.token')}</FormLabel>
        <TextField size="small" type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} />
      </FormControl>
    )}

    {/* SSH鍵フィールド */}
    {authType === 'ssh_key' && (
      <>
        <FormControl size="small">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormLabel sx={{ mb: 0 }}>{t('share.sshKey')}</FormLabel>
            <ActionButton variant="cancel" label={t('share.loadFromFile')} icon={<FileOpenIcon />}
              onClick={handleLoadKeyFile} size="small" />
          </Box>
          <TextField
            size="small"
            multiline
            minRows={3}
            maxRows={6}
            value={sshKey}
            onChange={(e) => onSSHKeyChange(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '12px' } }}
          />
        </FormControl>
        <FormControl size="small">
          <FormLabel>{t('share.passphrase')}</FormLabel>
          <TextField size="small" type="password" value={passphrase} onChange={(e) => onPassphraseChange(e.target.value)} />
        </FormControl>
      </>
    )}

    {/* SSHエージェント: 追加入力なし */}
  </>);
}

export default AuthFields;
