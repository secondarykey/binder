import { useState, useEffect, useRef, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation } from "react-router";

import { Address } from '../bindings/binder/api/app';

import { IconButton, Paper } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import CommitIcon from '@mui/icons-material/Commit';
import PublishIcon from '@mui/icons-material/Publish';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';

import { Browser } from '@wailsio/runtime';
import FileMenu from './contents/LeftMenu/FileMenu';
import BinderTree from './contents/LeftMenu/BinderTree';

import { SettingsApplications, LibraryBooks as LibraryBooksIcon } from '@mui/icons-material';
import TemplateTree from './contents/LeftMenu/TemplateTree';

import Event, { EventContext } from './Event';

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
  const location = useLocation();

  // /editor/note/:id, /editor/diagram/:id, /editor/assets/:id など
  // template 以外のエディタルートは Editor 内部でツリーを管理するため #menu を非表示にする
  const isNonTemplateEditor = /^\/editor\/(?!template)/.test(location.pathname);

  //メニュー非表示用のクラス
  const [menuClasses, setMenuClasses] = useState("");
  // イベントハンドラ内で最新の開閉状態を参照するための ref
  const menuOpenRef = useRef(true);

  const [url, setURL] = useState("");

  /**
   * メニューを開く
   */
  const handleMenuOpen = () => {
    menuOpenRef.current = true;
    setMenuClasses("")
    evt.showMenu(true);
  }
  /**
   * メニューを閉じる
   */
  const handleMenuClose = () => {
    menuOpenRef.current = false;
    setMenuClasses("hideMenu")
    evt.showMenu(false);
  }

  /**
   * 初期処理
   */
  useEffect(() => {

    //アドレス変更時の処理
    evt.register("Menu", Event.ChangeAddress, function (arg) {
      setURL(arg);
    });

    // サイドバー開閉トグル
    evt.register("Menu", Event.ToggleSidebar, function () {
      if (menuOpenRef.current) {
        handleMenuClose();
      } else {
        handleMenuOpen();
      }
    });

    Address().then((arg) => {
      setURL(arg);
    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  }, []);

  const handleClickTree = () => {
    nav("/editor/note/index");
  }

  /**
   * バインダー設定を開く（モーダルで表示）
   */
  const handleClickBinderSetting = () => {
    evt.openBinderModal();
  }

  /**
   * 更新一覧（モーダルで開く）
   */
  const handleClickModified = () => {
    evt.openCommitModal();
  }

  /**
   * 公開一覧（モーダルで開く）
   */
  const handleClickPublish = () => {
    evt.openPublishModal();
  }

  /**
   * テンプレート設定
   */
  const handleClickTemplate = () => {
    nav("/template/view");
  }

  /**
   * 全体の設定を開く（モーダルで表示）
   */
  const handleSettingClick = () => {
    evt.openSettingModal();
  }

  /**
   * ブラウザで開く
   */
  const handleClickBrowser = () => {
    Browser.OpenURL(url);
  }

  //router の定義用に書いておく
  var tempTree = <TemplateTree />

  //バインダーが開いている時のみ表示するコンポーネント
  const OpenBinderComponent = () => {
    return (
      <>
        {/** BinderTree */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="binder" onClick={handleClickTree}>
          <LibraryBooksIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Modified  */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickModified}>
          <CommitIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Publish  */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickPublish}>
          <PublishIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Template */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="content" onClick={handleClickTemplate}>
          <ContentPasteIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Browser */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="browser" onClick={handleClickBrowser}>
          <OpenInBrowserIcon fill="white" className="leftIcon" />
        </IconButton>

        {/** Binder Setting */}
        <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickBinderSetting}>
          <SettingsApplications fill="white" className="leftIcon" />
        </IconButton>
      </>);
  }

  return (
    <>
      {/** 固定メニューの箇所 */}
      <Paper id="binderMenu">

        {/** Binderが開いている時のみ処理できないか？ */}

        <Routes>
          <Route path={"/"} element={<></>} />
          <Route path={"/file/*"} element={<></>} />
          <Route path="*" element={<OpenBinderComponent />} />
        </Routes>

        {/** Settingsのボタン */}
        <IconButton id="settingButton" className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleSettingClick}>
          <SettingsIcon className="leftIcon" />
        </IconButton>

      </Paper>

      {/** 非テンプレートエディタルートでは Editor 内部でツリーを管理するため非表示 */}
      {!isNonTemplateEditor && (
        <Paper id="menu" className={menuClasses}>

          {/** メニューの中身 */}
          <Paper id="leftContent">

            <Routes>

              {/** 複数指定のコンポーネントを作成 */}
              <Route path={"/"} element={<> <FileMenu /> </>} />
              <Route path={"/file/*"} element={<> <FileMenu /> </>} />
              <Route path={"/template/*"} element={tempTree} />
              <Route path={"/editor/template/:id"} element={tempTree} />

              <Route path="*" element={<>
                <BinderTree />
              </>} />

            </Routes>

          </Paper>

        </Paper>
      )}
    </>
  );
}


export default Menu;
