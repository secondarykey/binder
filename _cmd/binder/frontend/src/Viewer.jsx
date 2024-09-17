import { useEffect, useState } from "react";

import { Paper, Toolbar, Typography, IconButton } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';

import { Terminate } from "../wailsjs/go/api/App";

import Event from "./Event";

import Binder from "./contents/Binder";
import Setting from "./contents/Setting";
import BinderRegister from "./contents/BinderRegister";

import Editor from "./contents/Editor";
import Note from "./contents/Note";
import Diagram from "./contents/Diagram";
import Assets from "./contents/Assets";
import History from "./contents/History";
import BinderRemote from "./Viewer/BinderRemote";

import { Routes, Route } from "react-router-dom";

import "./assets/Viewer.css"
import Empty from "./components/Empty";
/**
 * コンテンツ表示部分
 * <pre>
 * タイトル部分だけ共通化し、残りはURLによりコンポーネントを切り替える
 * </pre>
 * @param {*} props 
 * @returns 
 */
function Viewer(props) {

  //タイトルの文字列
  const [title,setTitle] = useState("");

  //終了処理
  const handleExit = () => {
    Terminate().then(() => {
      console.log("?")
    }).catch((err) => {
      console.warn(err);
    });
  }

  /**
   * 初期処理
   */
  useEffect( ()=> {
    //タイトル変更のイベントを設定
    Event.register(Event.ReloadTitle,function(obj) {
      setTitle(obj);
    });
  });

  return (
    <>
      {/** タイトルと他を表示 */}
      <Paper id="viewer">

        <Toolbar id="mainTitle" className="title">
          {/** 表示名称 */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {/** アプリ終了 */}
          <IconButton id="closeButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={handleExit}>
            <CloseIcon />
          </IconButton>
        </Toolbar>

        {/** 
       * ここが分岐点になります 
        */}
        <Paper id="content">

          <Routes>
            <Route path="/" element={<History />} />
            <Route path="/file/new" element={<BinderRegister />} />

            <Route path="/binder/edit" element={<Binder />} />
            <Route path="/setting" element={<Setting />} />

            <Route path="/note/:mode/:currentId" element={<Note />} />
            <Route path="/diagram/:mode/:currentId" element={<Diagram />} />
            <Route path="/assets/:mode/:currentId" element={<Assets />} />

            <Route path="/template/view" element={<Empty />} />
            <Route path="/template/register/:type" element={<Empty />} />
            <Route path="/template/edit/:id" element={<Empty />} />

            <Route path="/editor/:mode/:id" element={<Editor />} />
          </Routes>

{/** 移行がまだなコンポーネント*/}
          {false &&
            <>
              <BinderRemote onMessage={props.onMessage} />
            </>
          }

        </Paper>
      </Paper>

    </>
  );
}

export default Viewer;