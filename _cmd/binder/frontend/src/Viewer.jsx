import { useEffect, useState } from "react";

import { Paper, Toolbar, Typography, IconButton } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';

import {Terminate} from "../wailsjs/go/api/App";
import Editor from "./Viewer/Editor";
import Binder from "./Viewer/Binder";
import Note from "./Viewer/Note";
import Diagram from "./Viewer/Diagram";
import Assets from "./Viewer/Assets";
import Setting from "./Viewer/Setting";
import BinderHistory from "./Viewer/BinderHistory";
import BinderRegister from "./Viewer/BinderRegister";
import BinderRemote from "./Viewer/BinderRemote";

import "./Viewer.css"
/**
 * 表示部分
 * 左メニューとのコントロールを基本的に行い、他の処理は他のコンポーネントで行う
 * @param {*} props 
 * @returns 
 */
function Viewer(props) {

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
    <Paper id="viewer">

      <Toolbar id="mainTitle" className="title">
        {/** 表示名称 */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {name}
        </Typography>

        {/** メニューを閉じる */}
        <IconButton id="closeButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={exit}>
          <CloseIcon />
        </IconButton>
      </Toolbar>

      {/** 
       * ここが分岐点になります 
        */}
      <Paper id="content">

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

export default Viewer;