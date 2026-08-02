import { useState, useEffect, useRef } from 'react';

import {
  Accordion, AccordionDetails, AccordionSummary,
  Checkbox, FormControlLabel, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { GetUserInfo } from '../../bindings/binder/api/app';

import AuthFields from './AuthFields';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 認証情報の折りたたみ欄（取り込み・送信で共用）
 * 保存済みの UserInfo を読み込み、API へ渡す形の認証情報を onChange で親へ通知する。
 *
 * @param {{
 *   onChange: (info: object) => void,
 *   save: boolean,
 *   onSaveChange: (save: boolean) => void,
 * }} props
 */
function AuthAccordion({ onChange, save, onSaveChange }) {

  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [authType, setAuthType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [sshKey, setSSHKey] = useState('');

  // onChange の同一性で通知ループが起きないよう ref 経由で呼ぶ
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    GetUserInfo().then((info) => {
      setUserName(info.name || '');
      setUserEmail(info.email || '');
      setAuthType(info.auth_type || '');
      setUsername(info.username || '');
      setPassword(info.password || '');
      setToken(info.token || '');
      setPassphrase(info.passphrase || '');
      if (info.bytes) {
        const decoder = new TextDecoder();
        setSSHKey(decoder.decode(new Uint8Array(info.bytes)));
      } else {
        setSSHKey('');
      }
      // 認証種別に関連する値が入力済みなら畳んでおく
      const at = info.auth_type || '';
      const hasValues =
        (at === 'basic' && (info.username || info.password)) ||
        (at === 'token' && info.token) ||
        (at === 'ssh_key' && info.bytes) ||
        (at === 'ssh_agent');
      setExpanded(!hasValues);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    onChangeRef.current({
      name: userName,
      email: userEmail,
      auth_type: authType,
      username,
      password,
      token,
      passphrase,
      filename: '',
      bytes: Array.from(new TextEncoder().encode(sshKey)),
    });
  }, [userName, userEmail, authType, username, password, token, passphrase, sshKey]);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, v) => setExpanded(v)}
      disableGutters
      sx={{ backgroundColor: 'transparent', boxShadow: 'none', '&::before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--text-secondary)' }} />}>
        <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {t('share.authType')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
        <AuthFields
          authType={authType} onAuthTypeChange={setAuthType}
          username={username} onUsernameChange={setUsername}
          password={password} onPasswordChange={setPassword}
          token={token} onTokenChange={setToken}
          passphrase={passphrase} onPassphraseChange={setPassphrase}
          sshKey={sshKey} onSSHKeyChange={setSSHKey}
        />
        <FormControlLabel
          control={<Checkbox checked={save} onChange={(e) => onSaveChange(e.target.checked)} size="small" />}
          label={t('share.saveCredentials')}
          sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
        />
      </AccordionDetails>
    </Accordion>
  );
}

export default AuthAccordion;
