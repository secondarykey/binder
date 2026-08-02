import { useState, useEffect, useContext } from 'react';
import {
  Box, Checkbox, CircularProgress, FormControl, FormControlLabel, FormLabel, TextField,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import RemoteSelect from '../components/RemoteSelect';
import AuthAccordion from '../components/AuthAccordion';
import { Push, PushDocs, CurrentBranch, GetPublishSettings } from '../../bindings/binder/api/app';

import { EventContext } from '../Event';
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 送信フォーム（未公開一覧の右パネルのタブ）
 * 記録済みの内容をリモートへ送る。公開データ（docs/）だけを送ることもできる。
 *
 * @param {{ onDone?: () => void }} props
 *   onDone は送信が完了した時に呼ばれる（ホスト側の後始末用）
 */
function SendForm({ onDone = () => {} }) {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [remoteName, setRemoteName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [authInfo, setAuthInfo] = useState(null);
  const [save, setSave] = useState(false);
  const [sending, setSending] = useState(false);

  // 公開設定
  const [publishOnly, setPublishOnly] = useState(false);
  const [publishBranch, setPublishBranch] = useState('gh-pages');
  const [publishSubDir, setPublishSubDir] = useState('');

  useEffect(() => {
    CurrentBranch().then((name) => {
      setBranchName(name || '');
    }).catch((err) => showError(err));

    GetPublishSettings().then((s) => {
      if (s) {
        setPublishOnly(s.publishOnly || false);
        setPublishBranch(s.publishBranch || 'gh-pages');
        setPublishSubDir(s.publishSubDir || '');
      }
    }).catch((err) => showError(err));
  }, []);

  // 送信は記録済みの内容だけを送るため、未記録があっても実行できる
  const handleSend = () => {
    if (!remoteName) return;
    setSending(true);

    const promise = publishOnly
      ? PushDocs(remoteName, publishBranch, publishSubDir, authInfo, save)
      : Push(remoteName, authInfo, save);

    promise.then(() => {
      evt.showSuccessMessage(publishOnly ? t('share.sendDocsSuccess') : t('share.sendSuccess'));
      onDone();
    }).catch((err) => {
      showError(err);
    }).finally(() => {
      setSending(false);
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '520px' }}>

      <RemoteSelect value={remoteName} onChange={(name) => setRemoteName(name)} />

      <FormControl size="small">
        <FormLabel>{t('share.currentBranch')}</FormLabel>
        <TextField size="small" value={branchName} InputProps={{ readOnly: true }} />
      </FormControl>

      {/* 公開データのみ送信する場合の送り先 */}
      <Box>
        <FormControlLabel
          control={
            <Checkbox checked={publishOnly} onChange={(e) => setPublishOnly(e.target.checked)} size="small" />
          }
          label={t('share.publishOnly')}
          sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px' } }}
        />
        {publishOnly && (
          <>
            <FormControl size="small" fullWidth sx={{ mt: 1 }}>
              <FormLabel>{t('share.publishBranch')}</FormLabel>
              <TextField size="small" value={publishBranch}
                onChange={(e) => setPublishBranch(e.target.value)} />
            </FormControl>
            <FormControl size="small" fullWidth sx={{ mt: 1 }}>
              <FormLabel>{t('share.publishSubDir')}</FormLabel>
              <TextField size="small" value={publishSubDir}
                onChange={(e) => setPublishSubDir(e.target.value)}
                placeholder={t('share.publishSubDirHint')} />
            </FormControl>
          </>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <ActionButton variant="confirm" label={t('share.sendButton')}
          icon={sending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          onClick={handleSend} disabled={sending || !remoteName || !authInfo?.auth_type} />
      </Box>

      <AuthAccordion onChange={setAuthInfo} save={save} onSaveChange={setSave} />

    </Box>
  );
}

export default SendForm;
