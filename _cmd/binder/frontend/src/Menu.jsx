import { useState, useEffect,useContext } from 'react';
import { Routes, Route, useNavigate } from "react-router-dom";

import { GetConfig, CloseBinder,Address } from '../wailsjs/go/api/App';

import { IconButton, Paper, Toolbar, Typography } from '@mui/material';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import UpdateIcon from '@mui/icons-material/Update';
import PublishIcon from '@mui/icons-material/Publish';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';

import FileMenu from './contents/FileMenu';
import BinderTree from './contents/BinderTree';

import { SettingsApplications } from '@mui/icons-material';
import TemplateTree from './contents/TemplateTree';

import Event,{EventContext} from './Event';

import "./assets/Menu.css";
import ModifiedMenu from './contents/ModifiedMenu';

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

function dateString() {
  return (new Date()).toISOString();
}

/*
 * 操作用のメニュー
 * <pre>
 * 基本操作のアイコンを左側に表示、
 * 他ツリーやメニューを他のコンポーネントで行う
 * </pre>
 * @param {*} props  
 * onClose=>閉じる際に呼び出される
 * onChangeMode=> モード変更時に呼び出される
 * @returns 
 */
function Menu(props) {

  //使い方
  const evt = useContext(EventContext)
  const nav = useNavigate();

  //上部タイトル表示
  const [title, setTitle] = useState("");
  //メニュー非表示用のクラス
  const [menuClasses, setMenuClasses] = useState("");

  const [url, setURL] = useState("");

  /**
   * メニューを開く
   */
  const handleMenuOpen = () => {
    setMenuClasses("")
    evt.showMenu(true);
  }
  /**
   * メニューを閉じる
   */
  const handleMenuClose = () => {
    setMenuClasses("hideMenu")
    evt.showMenu(false);
  }

  /**
   * 初期処理
   */
  useEffect(() => {

    evt.register("Menu",Event.ReloadBinderTitle,function(t) {
      setTitle(t);
    });
    setTitle("Binder");

    //設定を取得
    GetConfig().then((conf) => {
      //名称を設定
      setTitle(conf.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    //アドレス変更時の処理
    evt.register("Menu",Event.ChangeAddress,function(arg) {
      setURL(arg);
    });

    Address().then((arg) => {
      setURL(arg);
    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  },[]);

  /**
   * ホームボタンクリック
   */
  const handleClickHome = () => {

    //バインダーを閉じる
    CloseBinder().then(() => {
      //トップメニューに移動
      nav("/");
    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  }

  const handleClickTree = () => {
    nav("/editor/note/index");
  }

  /**
   * バインダー設定を開く
   */
  const handleClickBinderSetting = () => {
    nav("/binder/edit");
  }

  /**
   * 更新一覧
   */
  const handleClickModified = () => {
    nav("/status/modified/" + dateString());
  }

  /**
   * 公開一覧
   */
  const handleClickPublish = () => {
    nav("/status/published/" + dateString());
  }

  /**
   * テンプレート設定
   */
  const handleClickTemplate = () => {
    nav("/template/view");
  }

  /**
   * 全体の設定を開く
   */
  const handleSettingClick = () => {
    nav("/setting");
  }

  /**
   * ブラウザで開く
   */
  const handleClickBrowser = () => {
    window.runtime.BrowserOpenURL(url);
  }

  //router の定義用に書いておく
  var tempTree = <TemplateTree/>
  var modified = <ModifiedMenu/>

  //バインダーが開いている時のみ表示するコンポーネント
  const OpenBinderComponent = () => {
    return (
  <>
        {/** BinderTree */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="binder" onClick={handleClickTree}>
          <BinderSVGIcon contents="#1a1a1a" fill="white" className="leftIcon" width="36" height="36" />
        </IconButton>

        {/** Modified  */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleClickModified}>
          <UpdateIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Publish  */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleClickPublish}>
          <PublishIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Template */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="content" onClick={handleClickTemplate}>
          <ContentPasteIcon fill="white" className="leftIcon"  />
        </IconButton>

        {/** Browser */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="browser" onClick={handleClickBrowser}>
          <OpenInBrowserIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Binder Setting */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleClickBinderSetting}>
          <SettingsApplications fill="white" className="leftIcon" />
        </IconButton>
  </>);
  }

  console.log(location.href);

  return (
    <>
      {/** 固定メニューの箇所 */}
      <Paper id="binderMenu">
        {/** ホーム */}
        <IconButton className="leftButton" edge="start" color="inherit" aria-label="home" onClick={handleClickHome}>
          <HomeIcon className="leftIcon" />
        </IconButton>

        {/** Binderが開いている時のみ処理できないか？ */}

        <Routes>
            <Route path={"/"} element={<></>} />
            <Route path={"/file/*"} element={<></>} />
            <Route path="*" element={<OpenBinderComponent/>} />
        </Routes>


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
            <Route path={"/template/*"} element={tempTree} />
            <Route path={"/editor/template/:id"} element={tempTree} />

            <Route path="/status/modified/:date" element={modified} />
            <Route path="/status/modified/:type/:currentId" element={modified} />

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