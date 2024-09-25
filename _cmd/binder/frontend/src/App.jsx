import { useEffect } from 'react';
import Menu from './Menu.jsx';
import Viewer from './Viewer.jsx';
import { Button, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Slide, Snackbar } from '@mui/material';

import { SavePosition, GetSetting } from '../wailsjs/go/api/App.js';

import Event from "./Event";
import Message, { SystemMessage } from './Message';

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

  useEffect(() => {

    console.log(location.href)
    //設定を取得
    GetSetting().then((s) => {
      if (s.path.runWithOpen) {
        //TODO バインダーを選択する
      } else {
      }
    }).catch((err) => {
      Message.showError(err);
    });

    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    //定期処理を実行
    intervalId = setInterval(function () {
      //メニュー表示、メニュー位置、スプリット位置
      SavePosition();
    }, 60 * 1000);

  }, []);

  return (
    <div id="App">
      {/** 左メニュー部 */}
      <Menu />
      {/** メイン表示 */}
      <Viewer />
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

export default App
