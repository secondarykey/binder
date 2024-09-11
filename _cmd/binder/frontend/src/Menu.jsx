import { useState, useEffect } from 'react';

import { IconButton, Paper, Toolbar, Typography } from '@mui/material';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';

import FileMenu from './Menu/FileMenu';
import BinderTree from './Menu/BinderTree';
import { GetConfig, CloseBinder } from '../wailsjs/go/api/App';

import "./Menu.css";
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

  const [title, setTitle] = useState("");
  const [menuClasses, setMenuClasses] = useState("");

  const handleMenuOpen = () => {
    setMenuClasses("")
  }

  const handleMenuClose = () => {
    setMenuClasses("hideMenu")
  }

  useEffect(() => {
    if (props.mode == "binder") {
      //開いているモードによる
      GetConfig().then((conf) => {
        setTitle(conf.name);
      }).catch((err) => {
        showMessage("error", err);
      });
    } else {
      setTitle("Binder");
    }
  }, [props.mode]);

  const clickHome = () => {
    CloseBinder().then(() => {
      props.onChangeMode("file");
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
  }
  const handleSettingClick = () => {
    props.onChangeMode("setting");
  }
  return (
    <>
      {/** 固定メニューの箇所 */}
      <Paper id="binderMenu">
        {/** ホーム */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="home" onClick={clickHome}>
          <HomeIcon className="leftIcon" />
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

        {menuClasses === "" &&
          <Toolbar id="titleBar" className="title">
            {/** TODO 開いているバインダーの名称 */}
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              <>Title</>
            </Typography>

            {/** メニューを閉じる */}
            <IconButton id="expandButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={handleMenuClose}>
              <ExpandCircleDownIcon id="expandIcon" />
            </IconButton>

          </Toolbar>
        }

        <Paper id="leftContent">

          {/** バインダーを開いてない場合や戻ってきた場合に利用 */}
          {props.mode === "file" &&
            <>
              <FileMenu onMessage={props.onMessage}
                onChangeMode={props.onChangeMode} />
            </>
          }

          {/** バインダーを開いている場合に利用 */}
          {props.mode === "binder" &&
            <>
              <BinderTree id={props.id} parentId={props.parentId}
                onChangeMode={props.onChangeMode}
                onMessage={props.onMessage}
                redraw={props.redraw} />
            </>
          }
        </Paper>

      </Paper>
    </>
  );
}


export default Menu;