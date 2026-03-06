import { useState, useContext, useEffect } from 'react';
import Menu from './Menu.jsx';
import Content from './Content.jsx';

import { Box, Toolbar, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PushPinIcon from '@mui/icons-material/PushPin';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseIcon from '@mui/icons-material/Close';

import { Window } from '@wailsio/runtime';
import { SavePosition, GetSetting, Terminate, GetConfig } from '../bindings/binder/api/app';

import Event, { EventContext } from "./Event";
import { SystemMessage } from './Message';

import './assets/App.css';

/**
 * クリップボードのコピー
 * @param {*} val
 */
export async function copyClipboard(val) {

  var clip = navigator.clipboard;
  if (clip === undefined) {
    if (global !== undefined) {
      clip = global.navigator.clipboard;
    }
  }

  if (clip !== undefined) {
    await clip.writeText(val);
  } else {
    console.warn("clip board error")
  }
}

var intervalId = undefined;

/**
 * アプリケーション全体
 * @returns
 */
function App() {

  const evt = useContext(EventContext)

  //文書名（ページタイトル: ノート名・画面名など）
  const [pageTitle, setPageTitle] = useState("");
  //開いているBinder名
  const [binderName, setBinderName] = useState("");
  const [pin, setPin] = useState(false);

  // Binder名を GetConfig() から取得してセット
  const loadBinderName = () => {
    GetConfig().then((conf) => {
      setBinderName(conf.name);
    }).catch(() => {
      // バインダー未選択時はエラーを無視
    });
  };

  useEffect(() => {

    //文書名（ページタイトル）変更イベント
    evt.register("App", Event.ReloadTitle, function (obj) {
      setPageTitle(obj);
    });

    //Binder名を編集保存したときのイベント
    evt.register("App", Event.ReloadBinderTitle, function (obj) {
      setBinderName(obj);
    });

    //バインダーを開いたとき（アドレス変更時）にBinder名を再取得
    evt.register("App", Event.ChangeAddress, function () {
      loadBinderName();
    });

    //初回取得
    loadBinderName();

    //設定を取得
    GetSetting().then((s) => {
      if (s.path.runWithOpen) {
        //TODO バインダーを選択する
      } else {
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    //定期処理を実行
    intervalId = setInterval(function () {
      //メニュー表示、メニュー位置、スプリット位置
      SavePosition();
    }, 60 * 1000);

    /**
     * リロード周りのバグ時のデバッグ
    window.addEventListener('beforeunload', function(event) {
      console.log(event)
      event.preventDefault();
      console.log("beforeload")
    })
    window.addEventListener('popstate', function(event) {
      event.preventDefault();
      console.log("popstate")
    })
    window.addEventListener('hashchange', function(event) {
      event.preventDefault();
      console.log("hashchange")
    })
     */

  }, []);

  const handlePin = () => {
    var p = !pin;
    Window.SetAlwaysOnTop(p);
    setPin(p);
  }

  const handleMin = () => {
    Window.Minimise();
  }

  const handleMax = () => {
    Window.ToggleMaximise();
  }

  //終了処理
  const handleExit = () => {
    //TODO 終了処理を入れる
    Terminate().then(() => {
      console.log("?")
    }).catch((err) => {
      console.warn(err);
    });
  }

  var pinClass = pin ? "top" : "";

  return (
    <div id="App">

      {/** 全幅タイトルバー */}
      <Toolbar id="mainTitle" className="binderTitle">

        {/** 左セクション: ハンバーガー + Binder名 */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {/** ハンバーガーアイコン（将来的にメニュー開閉に使用） */}
          <IconButton size="small" color="inherit" aria-label="menu" sx={{ mr: 1, ml: '-1px' }}>
            <MenuIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" component="div" noWrap>
            {binderName}
          </Typography>
        </Box>

        {/** 中央セクション: 文書名（ノート名・画面名） */}
        <Typography variant="body1" component="div" noWrap sx={{ textAlign: 'center', px: 1 }}>
          {pageTitle}
        </Typography>

        {/** 右セクション: ウィンドウ操作ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 2, mr: 0.5 }}>
          {/** ピン留め */}
          <IconButton id="pinBtn" className={pinClass} size="small" color="inherit" aria-label="pin" onClick={handlePin}>
            <PushPinIcon fontSize="small" />
          </IconButton>
          {/** 最小化 */}
          <IconButton size="small" color="inherit" aria-label="minimum" onClick={handleMin}>
            <MinimizeIcon fontSize="small" />
          </IconButton>
          {/** 最大化 */}
          <IconButton size="small" color="inherit" aria-label="maximize" onClick={handleMax}>
            <MaximizeIcon fontSize="small" />
          </IconButton>
          {/** アプリ終了（右端に8px余白） */}
          <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleExit}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

      </Toolbar>

      {/** タイトルバー下のメインエリア（左メニュー＋コンテンツ） */}
      <div id="mainArea">
        {/** 左メニュー部 */}
        <Menu />
        {/** メイン表示 */}
        <Content />
      </div>

      {/** 別コンポーネントメッセージ */}
      <SystemMessage />
    </div>
  );
}

/**
 * コンポーネント非表示
 * @returns
 */
export function Hidden() {
  return <></>;
}

/**
 * 各種モード
 */
export const Mode = Object.freeze({
    template: 'template',
    asset: 'asset',
    note: 'note',
    diagram: 'diagram',
})

export default App
