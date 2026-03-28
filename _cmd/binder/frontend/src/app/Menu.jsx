import { useState, useEffect, useRef, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation } from "react-router";

import { IconButton, Paper, Divider, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import CommitIcon from '@mui/icons-material/Commit';
import PublishIcon from '@mui/icons-material/Publish';
import FileMenu from './FileMenu';
import BinderTree from '../components/BinderTree';

import { SettingsApplications, LibraryBooks as LibraryBooksIcon, Search as SearchIcon } from '@mui/icons-material';
import { OpenSearchWindow } from '../../bindings/main/window';
import TemplateTree from './TemplateTree';

import Event, { EventContext } from '../Event';

import "../i18n/config";
import { useTranslation } from 'react-i18next'
import "../assets/Menu.css";

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

  const {t} = useTranslation();

  //使い方
  const evt = useContext(EventContext)
  const nav = useNavigate();
  const location = useLocation();

  // エディタルートでは Editor 内部でツリーを管理するため #menu を非表示にする
  const isEditorRoute = /^\/editor\//.test(location.pathname);

  //メニュー非表示用のクラス
  const [menuClasses, setMenuClasses] = useState("");
  // イベントハンドラ内で最新の開閉状態を参照するための ref
  const menuOpenRef = useRef(true);

  // エディタルートから離脱した際に #menu を開いた状態へリセットする。
  // エディタルートでは #menu が非表示のため、menuClasses が "hideMenu" のまま
  // 残ると他の画面で #menu が非表示になってしまうのを防ぐ。
  useEffect(() => {
    if (!isEditorRoute) {
      setMenuClasses("");
      menuOpenRef.current = true;
    }
  }, [isEditorRoute]);

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

    // サイドバー開閉トグル
    evt.register("Menu", Event.ToggleSidebar, function () {
      if (menuOpenRef.current) {
        handleMenuClose();
      } else {
        handleMenuOpen();
      }
    });

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

  //router の定義用に書いておく
  var tempTree = <TemplateTree />

  //バインダーが開いている時のみ表示するコンポーネント
  const OpenBinderComponent = () => {
    return (
      <>
        {/** BinderTree */}
        <Tooltip title={t("menu.binder")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="binder" onClick={handleClickTree}>
            <LibraryBooksIcon fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>

        {/** Search  */}
        <Tooltip title={t("menu.search")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="search" onClick={() => OpenSearchWindow()}>
            <SearchIcon fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>

        {/** Template */}
        <Tooltip title={t("menu.template")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="content" onClick={handleClickTemplate}>
            <ContentPasteIcon fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>

        {/** Divider */}
        <Divider flexItem sx={{ borderColor: 'var(--border-primary)', mx: '6px' }} />

        {/** Modified  */}
        <Tooltip title={t("menu.commit")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickModified}>
            <CommitIcon fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>

        {/** Publish  */}
        <Tooltip title={t("menu.publish")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickPublish}>
            <PublishIcon fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>

        {/** Divider */}
        <Divider flexItem sx={{ borderColor: 'var(--border-primary)', mx: '6px' }} />

        {/** Binder Setting */}
        <Tooltip title={t("menu.config")} placement="right">
          <IconButton className="leftButton" size="small" edge="start" color="inherit" aria-label="setting" onClick={handleClickBinderSetting}>
            <SettingsApplications fill="white" className="leftIcon" />
          </IconButton>
        </Tooltip>
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
        <Tooltip title={t("menu.setting")} placement="right">
          <IconButton id="settingButton" className="leftButton" edge="start" color="inherit" aria-label="setting" onClick={handleSettingClick}>
            <SettingsIcon className="leftIcon" />
          </IconButton>
        </Tooltip>

      </Paper>

      {/** エディタルートでは Editor 内部でツリーを管理するため非表示。
           アンマウントせず display:none で隠すことで BinderTree のステートを保持する */}
        <Paper id="menu" className={menuClasses} style={{ display: isEditorRoute ? 'none' : undefined }}>

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
    </>
  );
}


export default Menu;
