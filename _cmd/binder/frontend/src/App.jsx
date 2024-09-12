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

  //メッセージ作成
  const createMessage = (obj) => {
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
  var initMsg = createMessage({type:"success",message:""});
  //メニューの開閉管理
  const [msgObj, setMessage] = useState(initMsg);
  const [msgDlg, setMessageDialog] = useState(false);

  //メニューの開閉管理
  const [redraw, setRedraw] = useState(new Date());
  //ツリー更新用
  const refreshTree = () => {
    setRedraw(new Date());
  }

  useEffect(() => {

    Event.register(Event.ShowMessage,(obj) => {
      showMessage(obj);
    })

    console.log(location.href);

    GetSetting().then((s) => {
      if (s.path.runWithOpen) {
      } else {
      }
    }).catch((err) => {
      showMessage("error", err);
    });
  }, []);

  //ポップアップ処理
  function SlideTransition(props) {
    return <Slide {...props} direction="left" />;
  }

  function hideMessage() {
    if (!msgDlg) {
      setMessage(createMessage("success", ""));
    }
  }

  function showMessage(obj) {
    if (obj.type === "clear") {
      hideMessage();
      return;
    }
    var obj = createMessage(obj);
    obj.show = true;
    setMessage(obj);
  }

  function closeDialog(e, reason) {
    if (reason !== 'backdropClick') {
      setMessageDialog(false);
      hideMessage();
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
        onClose={hideMessage}
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

export default App
