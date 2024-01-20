import { useState } from "react";

import { Paper, Toolbar, Typography, IconButton } from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import {Close} from "../../wailsjs/go/api/App";
import Editor from "./Editor";
import Note from "./Note";
import Data from "./Data";
import Assets from "./Assets";
/**
 * 表示部分
 * 左メニューとのコントロールを基本的に行い、他の処理は他のコンポーネントで行う
 * @param {*} props 
 * @returns 
 */
function MainViewer(props) {

    const open = () => {
        props.onOpen();
    }

    const exit = () => {
        Close();
    }

    const mode = props.mode;

    return (
    <>
    {/** タイトルと他を表示 */}
    <Paper id="mainViewer">
      <Toolbar id="mainmenu">
{/**    メニューを開いてない時だけ表示する */}
{!props.showMenu &&
        <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }} onClick={open}>
          <MenuIcon />
        </IconButton>
}

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {/** ノート選択時はノートID ＋データID */}
          sample
        </Typography>

        <IconButton size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={exit}>
          <CloseIcon />
        </IconButton>

      </Toolbar>

      {/** ここが分岐点になります 
        *  選んでいるファイルによって編集可能かどうかを判定
        *  基本的にノート、データ設定のあるもののみを編集対象にする
        *
        * History(最初に表示？)
        * Editor
        * Config 
        */}
      <Paper id="viewer">
{mode === "binder" &&
<></>
}

{mode === "history" &&
<></>
}

{mode === "editor" &&
<>
  <Editor templateId={props.templateId} noteId={props.noteId} dataId={props.dataId} 
          onRefreshTree={props.onRefreshTree}
          onMessage={props.onMessage}/>
</>
}

{mode === "note" &&
<>
  <Note id={props.noteId} 
        onChangeMode={props.onChangeMode} 
        onRefreshTree={props.onRefreshTree}
        onMessage={props.onMessage}/>
</>
}

{mode === "data" &&
<>
  <Data id={props.dataId} noteId={props.noteId} 
        onChangeMode={props.onChangeMode} 
        onRefreshTree={props.onRefreshTree}
        onMessage={props.onMessage}/>
</>
}

{mode === "assets" &&
<>
  <Assets id={props.dataId} noteId={props.noteId} 
          onChangeMode={props.onChangeMode} 
          onRefreshTree={props.onRefreshTree}
          onMessage={props.onMessage}/>
</>
}
      </Paper>
    </Paper>

    </>
    );
}

export default MainViewer;