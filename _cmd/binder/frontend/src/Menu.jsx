import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from "react-router-dom";

import { GetConfig, CloseBinder } from '../wailsjs/go/api/App';

import { IconButton, Paper, Toolbar, Typography } from '@mui/material';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';

import Event from './Event';
import FileMenu from './Menu/FileMenu';
import BinderTree from './Menu/BinderTree';

import "./assets/Menu.css";

{/** Binderのアイコン */ }
function BinderSVGIcon(props) {
  return (<>
    <svg viewBox="0 0 320 320" width={props.width} height={props.height}>
      <defs>
        <g id="binder">
          <rect width="100" height="320" rx="5" xy="5" fill={props.fill} />

          <rect x="10" y="30" width="80" height="35" rx="2" xy="2" fill={props.contents} />
          <rect x="10" y="90" width="80" height="35" rx="2" xy="2" fill={props.contents} />
          <circle cx="50" cy="250" r="20" fill={props.contents} />
        </g>
      </defs>

      <use href="#binder" transform="translate(0,0)"></use>
      <use href="#binder" transform="translate(110,0)"></use>
      <use href="#binder" transform="translate(220,0)"></use>
    </svg>
  </>);
}
/*
 * 操作用のメニュー
 * 
 * 上位メニューは非表示、ホームに戻るを有する
 * @param {*} props  
 * onClose=>閉じる際に呼び出される
 * onChangeMode=> モード変更時に呼び出される
 * @returns 
 */
function Menu(props) {

  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [menuClasses, setMenuClasses] = useState("");

  const handleMenuOpen = () => {
    setMenuClasses("")
  }
  const handleMenuClose = () => {
    setMenuClasses("hideMenu")
  }

  useEffect(() => {
    //開いているモードによる
    GetConfig().then((conf) => {
      setTitle(conf.name);
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
    setTitle("Binder");
  },[]);

  const handleClickHome = () => {
    CloseBinder().then(() => {
      nav("/");
    }).catch((err) => {
      Event.showErrorMessage(err);
    })
  }

  const handleClickBinder = () => {
    nav("/binder/edit");
  }

  const handleSettingClick = () => {
    nav("/setting");
  }

  return (
    <>
      {/** 固定メニューの箇所 */}
      <Paper id="binderMenu">
        {/** ホーム */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="home" onClick={handleClickHome}>
          <HomeIcon className="leftIcon" />
        </IconButton>

        <IconButton className="leftButton" edge="start" color="inherit" aria-label="home" onClick={handleClickBinder}>
          <BinderSVGIcon contents="#1a1a1a" fill="white" className="leftIcon" width="36" height="36" />
        </IconButton>

        {/** メニューを閉じてる場合 */}
        {/** メニューを開く */}
        {menuClasses !== "" &&
          <IconButton className="leftButton" edge="start" color="inherit" aria-label="open" onClick={handleMenuOpen}>
            <ExpandCircleDownIcon className="openIcon leftIcon" />
          </IconButton>
        }

        {/** Settingsのボタン */}
        <IconButton id="settingButton" className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleSettingClick}>
          <SettingsIcon className="leftIcon" />
        </IconButton>
      </Paper>

      <Paper id="menu" className={menuClasses}>
        {/** メニュークラスが設定されている(hide)場合、非表示*/}
        {menuClasses === "" &&
          <Toolbar id="titleBar" className="title">
            {/** TODO 開いているバインダーの名称 */}
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              <>{title}</>
            </Typography>

            {/** メニューを閉じる */}
            <IconButton id="expandButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={handleMenuClose}>
              <ExpandCircleDownIcon id="expandIcon" />
            </IconButton>

          </Toolbar>
        }

        <Paper id="leftContent">

          <Routes>
            {/** 複数指定のコンポーネントを作成 */}
            <Route path={"/"} element={<> <FileMenu /> </>} />
            <Route path={"/file/*"} element={<> <FileMenu /> </>} />

            <Route path="*" element={<>
              <BinderTree />
            </>} />

          </Routes>

        </Paper>

      </Paper>
    </>
  );
}


export default Menu;