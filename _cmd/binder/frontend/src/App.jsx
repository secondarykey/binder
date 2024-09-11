import { useEffect, useState } from 'react';
import Menu from './Menu.jsx';
import Viewer from './Viewer.jsx';
import { Button, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Slide, Snackbar } from '@mui/material';

import { Routes, Route } from "react-router-dom";
import { GetSetting } from '../wailsjs/go/api/App.js';

import './App.css';
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
  const createMessage = (type, err) => {
    var obj = {};
    obj.type = type;
    var msg = "";

    if (typeof err === 'object') {
      if (err.stack) {
        msg = err.stack;
      } else {
        msg = "unknown error";
      }
    } else {
      msg = err;
    }

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
  var initMsg = createMessage("success", "");
  //メニューの開閉管理
  const [msgObj, setMessage] = useState(initMsg);
  const [msgDlg, setMessageDialog] = useState(false);

  //メニューの開閉管理
  const [redraw, setRedraw] = useState(new Date());

  //ツリー更新用
  const refreshTree = () => {
    setRedraw(new Date());
  }

  //表示モード指定用
  const [leftMode, setLeftMode] = useState('file');
  const [rightMode, setRightMode] = useState('selectFile');

  //指定ID
  const [ids, setCurrentId] = useState({ id: "index", parentId: "" });
  function setIds(id, parentId) {
    setCurrentId({ id: id, parentId: parentId });
  }

  useEffect(() => {
    console.debug("App loaded()")
    console.log(location.href);
    GetSetting().then((s) => {
      if (s.path.runWithOpen) {
        setLeftMode("binder");
        setRightMode("binder");
      }
    }).catch((err) => {
      showMessage("error", err);
    });
  }, []);


  /**
   * モードの変更
   * @param {string} mode 変更モード
   * @param {string} id 指定ID
   */
  const changeMode = async (mode, id, parentId) => {

    var leftM = leftMode;
    var rightM = rightMode;
    //テンプレートモードの場合
    if (mode === "template") {

      rightM = "templateEditor"
      setIds(id, parentId);

    } else if (mode === "noteEditor" || mode === "diagramEditor" ||
      mode === "note" || mode === "diagram" || mode === "assets") {
      leftM = "binder";

      rightM = mode;
      // ID 指定系のモードの場合
      setIds(id, parentId);

    } else if (mode === "config") {
      rightM = "binder";
    } else if (mode === "loadBinder") {
      leftM = "binder";
      rightM = "binder";
    } else if (mode === "file") {
      leftM = mode;
      rightM = "openHistory";
    } else if (mode === "registerBinder") {
      leftM = "file";
      rightM = "registerBinder";
    } else if (mode === "remoteBinder") {
      leftM = "file";
      rightM = "remoteBinder";
    } else if (mode === "setting") {
      rightM = "setting"
    } else {
      //IDなしへのモード切り替え　
      setIds();
    }
    setLeftMode(leftM);
    setRightMode(rightM);
  }

  //ポップアップ処理
  function SlideTransition(props) {
    return <Slide {...props} direction="left" />;
  }

  function hideMessage() {
    if (!msgDlg) {
      setMessage(createMessage("success", ""));
    }
  }

  function showMessage(type, msg) {
    if (type === "clear") {
      hideMessage();
      return;
    }

    var obj = createMessage(type, msg);
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

      <Routes>
        <Route path="/" element={
          <Menu
            id={ids.id}
            parentId={ids.parentId}
            mode={leftMode}
            onChangeMode={changeMode}
            onMessage={showMessage}
            onRefreshTree={refreshTree} redraw={redraw} />
        } />
      </Routes>

      <Viewer
        mode={rightMode} id={ids.id} parentId={ids.parentId}
        onChangeMode={changeMode}
        onMessage={showMessage}
        onRefreshTree={refreshTree} />

      {/*  ポップアップ表示 */}
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
