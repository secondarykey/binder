import { useEffect, useState } from 'react';
import Menu from './Menu.jsx';
import Viewer from './Viewer.jsx';
import { Button, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Slide, Snackbar } from '@mui/material';

import { GetSetting } from '../wailsjs/go/api/App.js';

import Event from "./Event";
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

/**
 * アプリケーション全体
 * @returns 
 */
function App() {

  /**
   * SnackBarに表示するオブジェクトに編集
   * @param {*} obj 
   * @returns 
   */
  const createSlideMessage = (obj) => {
    var msg = obj.message;
    var idx = msg.indexOf("\n");
    if (idx === -1) {
      obj.title = msg;
      obj.message = "";
    } else {
      obj.title = msg.substring(0, idx);
      obj.message = msg.substring(idx + 1);
    }
    obj.show = false;
    return obj;
  }

  //現在の設定を取得(最初に画面表示を選ぶ)
  var initMsg = createSlideMessage({type:"success",message:""});
  //メニューの開閉管理
  const [msgObj, setMessage] = useState(initMsg);
  const [msgDlg, setMessageDialog] = useState(false);

  useEffect(() => {

    console.log(location.href)
    //イベント登録
    Event.register(Event.ShowMessage,(obj) => {
      showSlideMessage(obj);
    })

    //設定を取得
    GetSetting().then((s) => {
      if (s.path.runWithOpen) {
        //TODO バインダーを選択する
      } else {
      }
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
  }, []);

  //ポップアップ処理
  function SlideTransition(props) {
    return <Slide {...props} direction="left" />;
  }

  /**
   * メッセージを消去する
   */
  function hideSlideMessage() {
    if ( !msgDlg ) {
      setMessage({show:false});
    }
  }

  function showSlideMessage(obj) {
    if (obj.type === "clear") {
      hideSlideMessage();
      return;
    }
    var obj = createSlideMessage(obj);
    obj.show = true;
    setMessage(obj);
  }

  function closeDialog(e, reason) {
    if (reason !== 'backdropClick') {
      setMessageDialog(false);
      hideSlideMessage();
    }
  }

  function showMessageDialog() {
    if (msgObj.message !== "") {
      setMessageDialog(true);
    }
  }

  return (
    <div id="App">

      {/** 左メニュー部 */}
      <Menu/>
      {/** メイン表示 */}
      <Viewer/>

      {/** ポップアップ表示 */}
      <Snackbar open={msgObj.show && !msgDlg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={SlideTransition}
        onDoubleClick={showMessageDialog}
        onClose={hideSlideMessage}
        autoHideDuration={msgObj.type === "success" ? 2000 : null}>
        <Alert severity={msgObj.type}
          variant="filled"
          sx={{ width: '100%' }}>
          {msgObj.title}
        </Alert>
      </Snackbar>

      {/*  全体のダイアログ */}
      <Dialog open={msgDlg}
        keepMounted
        onClose={closeDialog}
        aria-describedby="alert-dialog-slide-description" >
        <DialogTitle>{msgObj.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description" className="messageTxt">
            {msgObj.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>

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
