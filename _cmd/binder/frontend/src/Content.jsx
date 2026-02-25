import { useEffect, useState, useContext } from "react";

import { Paper, Toolbar, Typography, IconButton } from "@mui/material";
import PushPinIcon from '@mui/icons-material/PushPin';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseIcon from '@mui/icons-material/Close';

import { Terminate } from "../bindings/binder/api/app";

import Event, { EventContext } from "./Event";

import Binder from "./contents/Binder";
import Setting from "./contents/Setting";
import BinderRegister from "./contents/BinderRegister";

import Editor from "./contents/Editor/Component";
import Note from "./contents/Note";
import Diagram from "./contents/Diagram";
import Assets from "./contents/Assets";
import History from "./contents/History";
import BinderRemote from "./contents/BinderRemote";

import { Routes, Route } from "react-router";

import Template from "./contents/Template";
import { Hidden } from "./App";

import "./assets/Content.css"
import Patch from "./contents/Patch";
import Commit from "./contents/Commit";

import { Window } from '@wailsio/runtime';

/**
 * コンテンツ表示部分
 * <pre>
 * タイトル部分だけ共通化し、残りはURLによりコンポーネントを切り替える
 * </pre>
 * @param {*} props 
 * @returns 
 */
function Content(props) {

  const evt = useContext(EventContext)
  //タイトルの文字列
  const [title, setTitle] = useState("");
  const [pin, setPin] = useState(false);

  const handlePin = () => {
    var p = !pin;
    Window.SetAlwaysOnTop(p);
    setPin(p)
  }

  const handleMin = () => {
    Window.Minimise();
  }

  const handleMax = () => {
    Window.ToggleMaximise();
  }

  //終了処理
  const handleExit = () => {
    //TODO 終了処理を入れる
    Terminate().then(() => {
      console.log("?")
    }).catch((err) => {
      console.warn(err);
    });
  }

  /**
   * 初期処理
   */
  useEffect(() => {
    //タイトル変更のイベントを設定
    evt.register("Content", Event.ReloadTitle, function (obj) {
      setTitle(obj);
    });
  });

  var pinClass = "";
  if (pin) {
    pinClass = "top";
  }


  return (
    <>
      {/** タイトルと他を表示 */}
      <Paper id="contentViewer">

        <Toolbar id="mainTitle" className="binderTitle">
          {/** 表示名称 */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>

          {/** ピン留め */}
          <IconButton id="pinBtn" className={pinClass} size="large" edge="start" color="inherit" aria-label="pin" sx={{ mr: 2 }} onClick={handlePin}>
            <PushPinIcon />
          </IconButton>
          {/** 最小化 */}
          <IconButton size="large" edge="start" color="inherit" aria-label="minimum" sx={{ mr: 2 }} onClick={handleMin}>
            <MinimizeIcon />
          </IconButton>
          {/** 最大化 */}
          <IconButton size="large" edge="start" color="inherit" aria-label="maxmize" sx={{ mr: 2 }} onClick={handleMax}>
            <MaximizeIcon />
          </IconButton>
          {/** アプリ終了 */}
          <IconButton size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={handleExit}>
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
            <Route path="/file/remote" element={<BinderRemote />} />


            <Route path="/binder/edit" element={<Binder />} />
            <Route path="/setting" element={<Setting />} />

            <Route path="/note/:mode/:currentId" element={<Note />} />
            <Route path="/diagram/:mode/:currentId" element={<Diagram />} />
            <Route path="/assets/:mode/:currentId" element={<Assets />} />
            <Route path="/template/:mode/:currentId" element={<Template />} />

            <Route path="/template/view" element={<Hidden />} />
            <Route path="/status/modified/:date" element={<Commit />} />
            <Route path="/status/modified/:type/:currentId" element={<Patch />} />

            <Route path="/editor/:mode/:id" element={<Editor />} />

          </Routes>

        </Paper>
      </Paper>

    </>
  );
}

export default Content;