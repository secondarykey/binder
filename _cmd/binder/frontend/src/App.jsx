import { useEffect, useState } from 'react';
import './App.css';
import LeftMenu from './Menu/LeftMenu.jsx';
import MainViewer from './Viewer/MainViewer.jsx';
import { Button, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Popover, Slide, Snackbar } from '@mui/material';
import { GetConfig } from '../wailsjs/go/api/App.js';
import { GetSetting } from '../wailsjs/go/api/App.js';

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
  const [msg, setMessage] = useState(initMsg);
  const [msgDlg, setMessageDialog] = useState(false);

  //メニューの開閉管理
  const [isMenuOpen, showMenu] = useState(true);

  const [redraw, setRedraw] = useState(new Date());

  //ツリー更新用
  const refreshTree = () => {
    setRedraw(new Date());
  }

  //表示モード指定用
  const [leftMode, setLeftMode] = useState('file');
  const [rightMode, setRightMode] = useState('selectFile');

  //指定ID
  const [dataId, setDataId] = useState(undefined);
  const [noteId, setNoteId] = useState(undefined);
  const [templateId, setTemplateId] = useState(undefined);
  const [config, setConfig] = useState(undefined);

  useEffect(() => {
    console.info("App loaded()")
    GetSetting().then( (s) => {
      if ( s.path.runWithOpen ) {
        setLeftMode("binder");
        setRightMode("binder");
      }
    }).catch( (err) => {
      showMessage("error",err);
    });
  },[]);

  useEffect(() => {
    //開いているモードによる
    GetConfig().then( (conf) => {
      setConfig(conf)
    }).catch( (err) => {
      showMessage("error",err);
    });
  },[config !== undefined ? config.updated : undefined]);

  /**
   * メニューを開く
   */
  const openMenu = () => {
    showMenu(true)
  }
  /**
   * メニューを閉じる
   */
  const hideMenu = () => {
    showMenu(false)
  }

  /**
   * モードの変更
   * @param {string} mode 変更モード
   * @param {string} id 指定ID
   * @param {string} parentId 親ID
   */
  const changeMode = async (mode, id, parentId) => {

    var leftM = leftMode;
    var rightM = rightMode;
    //テンプレートモードの場合
    if (mode === "template") {
        rightM = "editor"
        setTemplateId(id);
        setNoteId(undefined);
        setDataId(undefined)
    } else if ( mode === "editor" || mode === "note" || mode === "data" || mode === "assets" ) {

      leftM = "binder";
      rightM = mode;
      // ID 指定系のモードの場合
      if ( parentId === undefined) {
        setNoteId(id);
        setDataId(undefined)
        setTemplateId(undefined);
      } else {
        setNoteId(parentId);
        setDataId(id)
        setTemplateId(undefined);
      }
    } else if ( mode === "config" ) {
        rightM = "binder";
    } else if ( mode === "loadBinder" ) {
        leftM = "binder";
        rightM = "binder";
    } else if ( mode === "file" ) {
        leftM = mode;
        rightM = "openHistory";
    } else if ( mode === "registerBinder" ) {
        leftM = "file";
        rightM = "registerBinder";
    } else if ( mode === "remoteBinder" ) {
        leftM = "file";
        rightM = "remoteBinder";
    } else if ( mode === "setting" ) {
        rightM = "setting"
    } else {
      //IDなしへのモード切り替え　
      setNoteId(undefined);
      setDataId(undefined)
      setTemplateId(undefined);
    }
    setLeftMode(leftM);
    setRightMode(rightM);
  }

  function SlideTransition(props) {
    return <Slide {...props} direction="left" />;
  }

  function hideMessage() {
    if (!msgDlg) {
      setMessage(createMessage("success", ""));
    }
  }

  function showMessage(type, msg) {
    if ( type === "clear" ) {
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
    if (msg.message !== "") {
      setMessageDialog(true);
    }
  }

  return (
    <>
      <div id="App">

        {/** メニューを開いている場合 */}
        {isMenuOpen &&
          <>
            <LeftMenu 
              mode={leftMode}
              config={config}
              onClose={hideMenu}
              onChangeMode={changeMode}
              onMessage={showMessage}
              onRefreshTree={refreshTree} redraw={redraw} />
          </>
        }

        <MainViewer showMenu={isMenuOpen} onOpen={openMenu}
          mode={rightMode} dataId={dataId} noteId={noteId} templateId={templateId}
          config={config}
          onChangeMode={changeMode}
          onMessage={showMessage}
          onRefreshTree={refreshTree} />

        <Snackbar open={msg.show && !msgDlg}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
          onDoubleClick={showMessageDialog}
          onClose={hideMessage}
          autoHideDuration={msg.type === "success" ? 3000 : null}>
          <Alert severity={msg.type}
            variant="filled"
            sx={{ width: '100%' }}>
            {msg.title}
          </Alert>
        </Snackbar>

        <Dialog open={msgDlg}
          keepMounted
          onClose={closeDialog}
          aria-describedby="alert-dialog-slide-description" >
          <DialogTitle>{msg.title}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-slide-description" className="messageTxt">
              {msg.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActions>
        </Dialog>

      </div>
    </>);
}

export default App
