import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';

import OverallHistoryDetail from './OverallHistoryDetail';
import { BranchPanel } from '../dialogs/BranchModal';
import ImportPanel from '../dialogs/ImportPanel';

import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 全体履歴の右ペイン
 * BranchHistoryModal（アプリ内モーダル）と OverallHistoryApp（別ウィンドウ）で共用する。
 *
 * - コミットを選択している間はその詳細を表示する
 * - 未選択時はバインダー自体の操作（ブランチ / 取り込み）をタブで並べる
 *
 * binderPath 指定時（バインダー未オープンでディレクトリを直接指定）は取り込みタブを出さない。
 * ブランチ操作と違い MergeFromLocal / MergeFromRemote / RemoteList に ByPath 版が無く、
 * 開いていないバインダーには使えないため。
 *
 * スクロールはこのコンポーネント内で完結させる（子の BranchPanel / OverallHistoryDetail は
 * 高さを持たず親のスクロールに依存し、ImportPanel のコンフリクト解決は高さいっぱいを使うため）。
 *
 * @param {{ binderPath?: string, hash?: string, onBack: () => void, onClose?: () => void }} props
 */
function OverallHistoryRight({ binderPath = '', hash = null, onBack, onClose = () => {} }) {
  const { t } = useTranslation();

  const [tab, setTab] = useState('branch');

  if (hash) {
    return (
      <Box sx={{ height: '100%', overflowY: 'auto' }}>
        <OverallHistoryDetail binderPath={binderPath} hash={hash} onBack={onBack} />
      </Box>
    );
  }

  // バインダー未オープン時はタブを出さずブランチ操作だけを見せる
  if (binderPath) {
    return (
      <Box sx={{ height: '100%', overflowY: 'auto' }}>
        <BranchPanel binderPath={binderPath} onClose={onClose} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: '36px',
          flexShrink: 0,
          borderBottom: '1px solid var(--border-subtle)',
          '& .MuiTab-root': {
            minHeight: '36px',
            textTransform: 'none',
            fontSize: '13px',
            color: 'var(--text-muted)',
            '&.Mui-selected': { color: 'var(--text-primary)' },
          },
        }}
      >
        <Tab value="branch" label={t('branch.list')} />
        <Tab value="import" label={t('share.importTab')} />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tab === 'branch'
          ? <BranchPanel onClose={onClose} />
          : <ImportPanel onDone={onClose} />
        }
      </Box>
    </Box>
  );
}

export default OverallHistoryRight;
