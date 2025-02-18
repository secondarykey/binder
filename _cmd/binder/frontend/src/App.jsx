import { useContext, useEffect } from 'react';
import Menu from './Menu.jsx';
import Content from './Content.jsx';

import { SavePosition, GetSetting } from '../wailsjs/go/api/App.js';

import { EventContext } from "./Event";
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

  useEffect(() => {

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

  }, []);

  return (
    <div id="App">
      {/** 左メニュー部 */}
      <Menu />
      {/** メイン表示 */}
      <Content />
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
