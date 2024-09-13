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
import Diagram from "./Viewer/Diagram";
import Assets from "./Viewer/Assets";
import History from "./contents/History";
import BinderRemote from "./Viewer/BinderRemote";

import { Routes, Route } from "react-router-dom";

import "./assets/Viewer.css"
/**
 * コンテンツ表示部分
 * @param {*} props 
 * @returns 
 */
function Viewer(props) {

  const [title,setTitle] = useState("");

  const exit = () => {
    Terminate().then(() => {
      console.log("?")
    }).catch((err) => {
      console.warn(err);
    });
  }

  var mode = "";
  useEffect( ()=> {
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

          {/** メニューを閉じる */}
          <IconButton id="closeButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={exit}>
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

            <Route path="/editor/:mode/:id" element={<Editor />} />
          </Routes>

          {mode === "remoteBinder" &&
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