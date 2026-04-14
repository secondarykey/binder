import { useState, useContext } from 'react';

import { Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { Window } from '@wailsio/runtime';

import { EventContext } from '../Event';
import { SystemMessage } from '../Message';
import OverallHistoryMenu from './OverallHistoryMenu';
import OverallHistoryDetail from './OverallHistoryDetail';
import { BranchPanel } from '../dialogs/BranchModal';

import '../assets/App.css';
import '../assets/OverallHistoryApp.css';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * 全体履歴表示ウィンドウ
 * コミット一覧（左）とブランチ管理 or コミット詳細（右）を並べたスタンドアロンウィンドウ
 */
function OverallHistoryApp() {

  const evt = useContext(EventContext);
  const { t } = useTranslation();

  // URL search params から binderPath を取得（未オープン状態での起動用）
  const params = new URLSearchParams(window.location.search);
  const binderPath = params.get('binderPath') ?? '';

  const [selectedHash, setSelectedHash] = useState(null);

  const handleSelect = (hash) => {
    setSelectedHash(hash);
  };

  const handleClose = () => {
    Window.Close();
  };

  return (
    <div id="OverallHistoryApp">

      {/** タイトルバー（ドラッグ可能・フレームレス対応） */}
      <Toolbar id="overallHistoryTitle" className="binderTitle" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body1" sx={{ flex: 1 }} noWrap>
          {t('overallHistory.title')}{binderPath ? ` — ${binderPath}` : ''}
        </Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** メインエリア: 左=コミット一覧、右=ブランチ管理 or コミット詳細 */}
      <div id="overallHistoryArea">

        <div id="overallHistoryLeft">
          <OverallHistoryMenu
            binderPath={binderPath}
            selectedHash={selectedHash}
            onSelect={handleSelect}
            onClose={handleClose}
          />
        </div>

        <div id="overallHistoryRight">
          {selectedHash
            ? <OverallHistoryDetail binderPath={binderPath} hash={selectedHash} />
            : <BranchPanel binderPath={binderPath} onClose={handleClose} />
          }
        </div>

      </div>

      <SystemMessage />
    </div>
  );
}

export default OverallHistoryApp;
