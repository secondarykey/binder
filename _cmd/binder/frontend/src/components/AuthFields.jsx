import { Box, Button, FormControl, FormLabel, MenuItem, Select, TextField } from "@mui/material";
import FileOpenIcon from '@mui/icons-material/FileOpen';
import { SelectFileContent } from "../../bindings/main/window";
import "../language";
import { useTranslation } from 'react-i18next';

const AUTH_TYPES = [
  { value: 'basic', labelKey: 'push.authBasic' },
  { value: 'token', labelKey: 'push.authToken' },
  { value: 'ssh_key', labelKey: 'push.authSSHKey' },
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

    {/* SSH鍵フィールド */}
    {authType === 'ssh_key' && (
      <>
        <FormControl size="small">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormLabel sx={{ mb: 0 }}>{t('push.sshKey')}</FormLabel>
            <Button
              size="small"
              startIcon={<FileOpenIcon />}
              onClick={handleLoadKeyFile}
              sx={{ textTransform: 'none', fontSize: '12px', minWidth: 'auto' }}
            >
              {t('push.loadFromFile')}
            </Button>
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
          <FormLabel>{t('push.passphrase')}</FormLabel>
          <TextField size="small" type="password" value={passphrase} onChange={(e) => onPassphraseChange(e.target.value)} />
        </FormControl>
      </>
    )}

    {/* SSHエージェント: 追加入力なし */}
  </>);
}

export default AuthFields;
