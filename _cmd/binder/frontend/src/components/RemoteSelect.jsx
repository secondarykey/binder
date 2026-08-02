import { useState, useEffect } from 'react';

import { Box, FormControl, FormLabel, IconButton, MenuItem, Select } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import { RemoteList } from '../../bindings/binder/api/app';

import RemoteSetting from '../dialogs/RemoteSetting';
import { useDialogMessage } from '../dialogs/components/DialogError';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * リモート選択欄（取り込み・送信で共用）
 * 一覧の取得と、歯車から開くリモート設定（追加・編集・削除）を内部に閉じる。
 *
 * @param {{
 *   value: string,
 *   onChange: (name: string, url: string) => void,
 *   action?: React.ReactNode,
 * }} props
 *   action はセレクトの右に並べる追加操作（取り込み時の「接続」ボタンなど）
 */
function RemoteSelect({ value, onChange, action = null }) {

  const { showError } = useDialogMessage();
  const { t } = useTranslation();

  const [remotes, setRemotes] = useState([]);
  const [settingOpen, setSettingOpen] = useState(false);

  useEffect(() => {
    loadRemotes();
  }, []);

  // 選択中のリモートが消えていた場合のみ先頭へ寄せる。
  // リモート設定で他のリモートを触っただけで選択が変わると、
  // 送信先・取込元が意図せず入れ替わるため。
  const loadRemotes = () => {
    RemoteList().then((res) => {
      const list = res || [];
      setRemotes(list);
      const next = list.some((r) => r.name === value) ? value : (list[0]?.name ?? '');
      onChange(next, list.find((r) => r.name === next)?.url ?? '');
    }).catch((err) => showError(err));
  };

  const handleChange = (e) => {
    const name = e.target.value;
    onChange(name, remotes.find((r) => r.name === name)?.url ?? '');
  };

  return (
    <FormControl size="small">
      <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {t('share.remote')}
        {/** リモートの追加・編集・削除はここから行う */}
        <IconButton size="small" onClick={() => setSettingOpen(true)}
          title={t('binder.settingRemote')} aria-label="remote-setting">
          <SettingsIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </FormLabel>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 0 }}>
        <Select value={value} onChange={handleChange} size="small" sx={{ flex: 1, minWidth: 0 }}>
          {remotes.map((r) => (
            <MenuItem key={r.name} value={r.name}>{r.name} ({r.url})</MenuItem>
          ))}
        </Select>
        {action}
      </Box>

      <RemoteSetting
        open={settingOpen}
        onClose={() => setSettingOpen(false)}
        onChanged={loadRemotes}
      />
    </FormControl>
  );
}

export default RemoteSelect;
