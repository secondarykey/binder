import { useEffect, useState } from "react";

import { Paper, Toolbar, Typography, IconButton } from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import {Terminate} from "../../wailsjs/go/api/App";
import Editor from "./Editor";
import Binder from "./Binder";
import Note from "./Note";
import Diagram from "./Diagram";
import Assets from "./Assets";
import Setting from "./Setting";
import BinderHistory from "./BinderHistory";
import BinderRegister from "./BinderRegister";
import BinderRemote from "./BinderRemote";

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
        Terminate().then(()=> {
          console.log("?")
        }).catch( (err) => {
          console.warn(err);
        });
    }

    const [name,setName] = useState("");
    const mode = props.mode;

    console.debug("Mode    :" + mode);
    console.debug("Id      :" + props.id);
    console.debug("ParentId:" + props.parentId);

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
        {/** 表示名称 */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {name}
        </Typography>

        {/** メニューを閉じる */}
        <IconButton size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={exit}>
          <CloseIcon />
        </IconButton>

      </Toolbar>

      {/** 
       * ここが分岐点になります 
        */}
      <Paper id="viewer">

{mode === "binder" &&
<>
  <Binder onRefreshTree={props.onRefreshTree}
          onChangeTitle={setName}
          onMessage={props.onMessage}/>
</>
}

{mode === "setting" &&
<>
  <Setting onRefreshTree={props.onRefreshTree}
           onChangeTitle={setName}
           onMessage={props.onMessage}/>
</>
}

{mode === "registerBinder" &&
<>
  <BinderRegister onChangeMode={props.onChangeMode} 
                  onChangeTitle={setName}
                  onMessage={props.onMessage}/>
</>
}

{mode === "remoteBinder" &&
<>
  <BinderRemote onChangeMode={props.onChangeMode} 
                onChangeTitle={setName}
                onMessage={props.onMessage}/>
</>
}

{mode === "openHistory" &&
<>
  <BinderHistory onChangeMode={props.onChangeMode} 
                 onChangeTitle={setName}
                 onMessage={props.onMessage}/>
</>
}

{ (mode === "noteEditor" || mode === "diagramEditor") &&
<>
  <Editor id={props.id} mode={mode}
          showMenu={props.showMenu}
          onRefreshTree={props.onRefreshTree}
          onChangeTitle={setName}
          onMessage={props.onMessage}/>
</>
}

{mode === "note" &&
<>
  <Note id={props.id} parentId={props.parentId}
        onChangeMode={props.onChangeMode} 
        onRefreshTree={props.onRefreshTree}
        onChangeTitle={setName}
        onMessage={props.onMessage}/>
</>
}

{mode === "diagram" &&
<>
  <Diagram id={props.id} parentId={props.parentId}
        onChangeMode={props.onChangeMode} 
        onRefreshTree={props.onRefreshTree}
        onChangeTitle={setName}
        onMessage={props.onMessage}/>
</>
}

{mode === "assets" &&
<>
  <Assets id={props.id} parentId={props.parentId}
          onChangeMode={props.onChangeMode} 
          onRefreshTree={props.onRefreshTree}
          onChangeTitle={setName}
          onMessage={props.onMessage}/>
</>
}
      </Paper>
    </Paper>

    </>
    );
}

export default MainViewer;