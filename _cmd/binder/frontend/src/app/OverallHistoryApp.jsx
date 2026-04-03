import { useEffect, useContext } from 'react';
import { Routes, Route, useNavigate } from 'react-router';

import { Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { Window } from '@wailsio/runtime';

import { EventContext } from '../Event';
import { SystemMessage } from '../Message';
import OverallHistoryMenu from './OverallHistoryMenu';
import OverallHistoryDetail from './OverallHistoryDetail';

import '../assets/App.css';
import '../assets/OverallHistoryApp.css';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

/**
 * 全体履歴表示ウィンドウ
 * コミット一覧（左）とファイル一覧（右）を並べたスタンドアロンウィンドウ
 */
function OverallHistoryApp() {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const { t } = useTranslation();

  // URL search params から binderPath を取得（未オープン状態での起動用）
  const params = new URLSearchParams(window.location.search);
  const binderPath = params.get('binderPath') ?? '';

  useEffect(() => {
    nav('/overall/list');
  }, []);

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

      {/** メインエリア: 左=コミット一覧、右=ファイル一覧 */}
      <div id="overallHistoryArea">

        <div id="overallHistoryLeft">
          <Routes>
            <Route path="/overall/list"          element={<OverallHistoryMenu binderPath={binderPath} />} />
            <Route path="/overall/detail/:hash"  element={<OverallHistoryMenu binderPath={binderPath} />} />
            <Route path="*"                      element={<OverallHistoryMenu binderPath={binderPath} />} />
          </Routes>
        </div>

        <div id="overallHistoryRight">
          <Routes>
            <Route path="/overall/list"          element={<div id="overallHistoryEmpty" />} />
            <Route path="/overall/detail/:hash"  element={<OverallHistoryDetail binderPath={binderPath} />} />
            <Route path="*"                      element={<div id="overallHistoryEmpty" />} />
          </Routes>
        </div>

      </div>

      <SystemMessage />
    </div>
  );
}

export default OverallHistoryApp;
