import { useEffect, useContext } from 'react';
import { Routes, Route, useNavigate } from 'react-router';

import { Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { Window } from '@wailsio/runtime';

import { EventContext } from './Event';
import { SystemMessage } from './Message';
import ModifiedMenu from './contents/LeftMenu/ModifiedMenu';
import Commit from './contents/Commit';
import Patch from './contents/Patch';

import './assets/App.css';
import './assets/CommitApp.css';

/**
 * コミットウィンドウ
 * 変更ファイル一覧（左）とコミットフォーム/差分表示（右）を並べたスタンドアロンウィンドウ
 * 右パネル: 上=コミットフォーム（常時表示）、下=差分（ファイル選択時のみ表示）
 */
function CommitApp() {

  const evt = useContext(EventContext);
  const nav = useNavigate();

  useEffect(() => {
    // 初回表示時に date パラメータをセットして ModifiedMenu をロード
    nav("/status/modified/" + new Date().toISOString());
  }, []);

  const handleClose = () => {
    Window.Close();
  };

  return (
    <div id="CommitApp">

      {/** タイトルバー（ドラッグ可能・フレームレス対応） */}
      <Toolbar id="commitTitle" className="binderTitle" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body1" sx={{ flex: 1 }}>Commit</Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** メインエリア: 左=変更一覧、右=コミットフォーム＋差分 */}
      <div id="commitArea">

        <div id="commitLeft">
          <Routes>
            <Route path="/status/modified/:date" element={<ModifiedMenu />} />
            <Route path="/status/modified/:type/:currentId" element={<ModifiedMenu />} />
            <Route path="*" element={<ModifiedMenu />} />
          </Routes>
        </div>

        <div id="commitRight">
          {/** コミットフォーム: 常に上部に表示 */}
          <div id="commitForm">
            <Commit />
          </div>

          {/** 差分表示: ファイル選択時のみ下部に表示 */}
          <Routes>
            <Route path="/status/modified/:type/:currentId" element={
              <div id="commitPatch">
                <Patch />
              </div>
            } />
          </Routes>
        </div>

      </div>

      <SystemMessage />
    </div>
  );
}

export default CommitApp;
