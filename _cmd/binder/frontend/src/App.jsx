import {useEffect, useState} from 'react';
import './App.css';
import './assets/vim.min.js';
import LeftMenu from './Menu/LeftMenu.jsx';
import MainViewer from './Viewer/MainViewer.jsx';
import { Button,Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Popover, Slide, Snackbar, Typography } from '@mui/material';

/**
 * アプリケーション全体
 * @returns 
 */
function App() {

    function createMessage(type,err) {

      var obj = {};
      obj.type = type;
      var msg = "";
      if ( typeof err === 'object' ) {
        if ( err.stack ) {
          msg = err.stack;
        } else {
          msg = "unknown error";
        }
      } else {
        msg = err;
      }

      var idx = msg.indexOf("\n");
      if ( idx === -1 ) {
        obj.title = msg;
        obj.message = "";
      } else {
        obj.title = msg.substring(0,idx);
        obj.message = msg.substring(idx+1);
      }
      obj.show = false;
      return obj;
    }

    //メニューの開閉管理
    const [msg, setMessage] = useState(createMessage("success",""));
    const [msgDlg, setMessageDialog] = useState(false);

    //メニューの開閉管理
    const [isMenuOpen, showMenu] = useState(true);

    const [redraw, setRedraw] = useState(new Date());
    const refreshTree = () => {
      setRedraw(new Date());
    }

    //表示モード指定用
    const [mode, setMode] = useState('note');

    //指定ID
    const [dataId, setDataId] = useState(undefined);
    const [noteId, setNoteId] = useState(undefined);
    const [templateId, setTemplateId] = useState(undefined);

    useEffect(() => {
      vim.open({
        debug   : false,
        showMsg : function(msg){
            alert('vim.js say:' + msg);
        }
      });
    })

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
    const changeMode = (mode,id,parentId) => {
      //指定のあったIDに変更
      if ( parentId === undefined ) {
        if ( mode === "template" ) {
          mode = "editor"
          setTemplateId(id);
          setNoteId(undefined);
          setDataId(undefined)
        } else {
          setNoteId(id);
          setDataId(undefined)
          setTemplateId(undefined);
        }
      } else {
        setNoteId(parentId);
        setDataId(id)
        setTemplateId(undefined);
      }
      setMode(mode);
    }

    function SlideTransition(props) {
      return <Slide {...props} direction="left" />;
    }

    function hideMessage() {
      if ( !msgDlg ) {
        setMessage(createMessage("success",""));
      }
    }

    function showMessage(type,msg) {
      var obj = createMessage(type,msg);
      obj.show = true;
      setMessage(obj);
    }

    function closeDialog(e,reason) {
      if ( reason !== 'backdropClick') {
        setMessageDialog(false);
        hideMessage();
      }
    }

    function showMessageDialog() {
      if ( msg.message !== "" ) {
        setMessageDialog(true);
      }
    }

    return (
    <>
    <div id="App">

{isMenuOpen &&

      <LeftMenu onClose={hideMenu} onChangeMode={changeMode} onMessage={showMessage}
                onRefreshTree={refreshTree} redraw={redraw}/>
}

      <MainViewer showMenu={isMenuOpen} onOpen={openMenu} 
                  mode={mode} dataId={dataId} noteId={noteId} templateId={templateId} 
                  onChangeMode={changeMode} 
                  onMessage={showMessage}
                  onRefreshTree={refreshTree}/>

      <Snackbar open={msg.show && !msgDlg}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
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
          <DialogContentText id="alert-dialog-slide-description" class="messageTxt">
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
