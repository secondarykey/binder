import {useEffect, useState} from 'react';
import './App.css';
import './assets/vim.min.js';
import LeftMenu from './Menu/LeftMenu.jsx';
import MainViewer from './Viewer/MainViewer.jsx';

/**
 * アプリケーション全体
 * @returns 
 */
function App() {

    //メニューの開閉管理
    const [isMenuOpen, showMenu] = useState(true);
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

    return (
    <>
    <div id="App">

{isMenuOpen &&
      <LeftMenu onClose={hideMenu} onChangeMode={changeMode}/>
}
      <MainViewer showMenu={isMenuOpen} onOpen={openMenu} 
                  mode={mode} dataId={dataId} noteId={noteId} templateId={templateId} 
                  onChangeMode={changeMode} />
    </div>
    </>);
}

export default App
