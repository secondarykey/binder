import { useEffect, useContext } from 'react';
import { Routes, Route, useNavigate } from 'react-router';

import { Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { Window } from '@wailsio/runtime';

import { EventContext } from '../Event';
import { SystemMessage } from '../Message';
import HistoryMenu from './HistoryMenu';
import HistoryPatch from './HistoryPatch';

import '../assets/App.css';
import '../assets/HistoryApp.css';

/**
 * 履歴表示ウィンドウ
 * コミット一覧（左）と差分表示（右）を並べたスタンドアロンウィンドウ
 */
function HistoryApp() {

  const evt = useContext(EventContext);
  const nav = useNavigate();

  // URL search params から type・id・name を取得
  const params = new URLSearchParams(window.location.search);
  const typ  = params.get('type') ?? '';
  const id   = params.get('id')   ?? '';
  const name = params.get('name') ?? '';

  useEffect(() => {
    nav('/history/list');
  }, []);

  const handleClose = () => {
    Window.Close();
  };

  return (
    <div id="HistoryApp">

      {/** タイトルバー（ドラッグ可能・フレームレス対応） */}
      <Toolbar id="historyTitle" className="binderTitle" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body1" sx={{ flex: 1 }} noWrap>
          History{name ? ` — ${name}` : ''}
        </Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** メインエリア: 左=コミット一覧、右=差分表示 */}
      <div id="historyArea">

        <div id="historyLeft">
          <Routes>
            <Route path="/history/list"       element={<HistoryMenu typ={typ} id={id} />} />
            <Route path="/history/diff/:hash" element={<HistoryMenu typ={typ} id={id} />} />
            <Route path="*"                   element={<HistoryMenu typ={typ} id={id} />} />
          </Routes>
        </div>

        <div id="historyRight">
          <Routes>
            <Route path="/history/list"       element={<div id="historyEmpty" />} />
            <Route path="/history/diff/:hash" element={<HistoryPatch typ={typ} id={id} />} />
            <Route path="*"                   element={<div id="historyEmpty" />} />
          </Routes>
        </div>

      </div>

      <SystemMessage />
    </div>
  );
}

export default HistoryApp;
