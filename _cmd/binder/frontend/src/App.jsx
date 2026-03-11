import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import Menu from './Menu.jsx';
import Content from './Content.jsx';
import CommitModal from './CommitModal.jsx';
import SettingModal from './SettingModal.jsx';
import BinderModal from './BinderModal.jsx';

import { Box, Toolbar, Typography, IconButton } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import PushPinIcon from '@mui/icons-material/PushPin';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseIcon from '@mui/icons-material/Close';

import { Events, Window } from '@wailsio/runtime';
import { SavePosition, GetSetting, LoadBinder, Terminate, GetConfig, CloseBinder } from '../bindings/binder/api/app';

import Event, { EventContext } from "./Event";
import { SystemMessage } from './Message';

import './assets/App.css';

/**
 * クリップボードのコピー
 * @param {*} val
 */
export async function copyClipboard(val) {

  var clip = navigator.clipboard;
  if (clip === undefined) {
    if (global !== undefined) {
      clip = global.navigator.clipboard;
    }
  }

  if (clip !== undefined) {
    await clip.writeText(val);
  } else {
    console.warn("clip board error")
  }
}

var intervalId = undefined;

/**
 * アプリケーション全体
 * @returns
 */
function App() {

  const evt = useContext(EventContext)
  const nav = useNavigate();

  //文書名（ページタイトル: ノート名・画面名など）
  const [pageTitle, setPageTitle] = useState("");
  //開いているBinder名
  const [binderName, setBinderName] = useState("");
  const [pin, setPin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [binderModalOpen, setBinderModalOpen] = useState(false);

  // Binder名を GetConfig() から取得してセット
  const loadBinderName = () => {
    GetConfig().then((conf) => {
      setBinderName(conf.name);
    }).catch(() => {
      // バインダー未選択時はエラーを無視
    });
  };

  useEffect(() => {

    //文書名（ページタイトル）変更イベント
    evt.register("App", Event.ReloadTitle, function (obj) {
      setPageTitle(obj);
    });

    //Binder名を編集保存したときのイベント
    evt.register("App", Event.ReloadBinderTitle, function (obj) {
      setBinderName(obj);
    });

    //サイドバーの開閉状態を同期
    evt.register("App", Event.ShowMenu, function (flag) {
      setSidebarOpen(flag);
    });

    //コミットモーダルを開く
    evt.register("App", Event.OpenCommitModal, function () {
      setCommitModalOpen(true);
    });

    //設定モーダルを開く
    evt.register("App", Event.OpenSettingModal, function () {
      setSettingModalOpen(true);
    });

    //バインダー編集モーダルを開く
    evt.register("App", Event.OpenBinderModal, function () {
      setBinderModalOpen(true);
    });

    // 履歴ウィンドウでの復元完了通知: 対象ファイルをエディタで開き直す
    // 同じURLにいる場合でも強制再読み込みするため、state に restoredAt タイムスタンプを付与する
    const cleanupRestored = Events.On("binder:restored", (event) => {
      const { typ, id } = event.data ?? {};
      if (typ && id) {
        nav(`/editor/${typ}/${id}`, { state: { restoredAt: Date.now() } });
        evt.selectTreeNode(id);
      }
    });

    //バインダーを開いたとき（アドレス変更時）にBinder名を再取得
    evt.register("App", Event.ChangeAddress, function () {
      loadBinderName();
    });

    //初回取得
    loadBinderName();

    //設定を取得し、履歴があれば最後のバインダーをエディタで自動的に開く
    GetSetting().then((s) => {
      if (s.path.histories && s.path.histories.length > 0) {
        LoadBinder(s.path.histories[0]).then((href) => {
          evt.changeAddress(href);
          nav("/editor/note/index");
        }).catch((err) => {
          evt.showErrorMessage(err);
        });
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }

    //定期処理を実行
    intervalId = setInterval(function () {
      //メニュー表示、メニュー位置、スプリット位置
      SavePosition();
    }, 60 * 1000);

    return () => {
      cleanupRestored();
    };

    /**
     * リロード周りのバグ時のデバッグ
    window.addEventListener('beforeunload', function(event) {
      console.log(event)
      event.preventDefault();
      console.log("beforeload")
    })
    window.addEventListener('popstate', function(event) {
      event.preventDefault();
      console.log("popstate")
    })
    window.addEventListener('hashchange', function(event) {
      event.preventDefault();
      console.log("hashchange")
    })
     */

  }, []);

  /**
   * ホームボタンクリック: バインダーを閉じてトップへ移動
   */
  const handleClickHome = () => {
    CloseBinder().then(() => {
      nav("/");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const handlePin = () => {
    var p = !pin;
    Window.SetAlwaysOnTop(p);
    setPin(p);
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

  var pinClass = pin ? "top" : "";
  var sidebarClass = sidebarOpen ? "open" : "";

  return (
    <div id="App">

      {/** 全幅タイトルバー */}
      <Toolbar id="mainTitle" className="binderTitle" onDoubleClick={handleMax}>

        {/** 左セクション: ホームボタン + Binder名 + サイドバー開閉 */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {/** ホームボタン: バインダーを閉じてトップへ戻る */}
          <IconButton size="small" color="inherit" aria-label="home" sx={{ mr: 1, ml: '-2px' }} onClick={handleClickHome}>
            <StorageIcon fontSize="small" />
          </IconButton>
          <Typography variant="body1" component="div" noWrap>
            {binderName}
          </Typography>
          {/** サイドバー開閉: Binder名の横 */}
          <IconButton id="sidebarBtn" className={sidebarClass} size="small" color="inherit" aria-label="toggle sidebar" sx={{ ml: 1 }} onClick={() => evt.toggleSidebar()}>
            <ViewSidebarIcon fontSize="small" />
          </IconButton>
        </Box>

        {/** 中央セクション: 文書名（ノート名・画面名） */}
        <Typography variant="body1" component="div" noWrap sx={{ textAlign: 'center', px: 1 }}>
          {pageTitle}
        </Typography>

        {/** 右セクション: ウィンドウ操作ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 2, mr: 0.5 }}>
          {/** ピン留め */}
          <IconButton id="pinBtn" className={pinClass} size="small" color="inherit" aria-label="pin" onClick={handlePin}>
            <PushPinIcon fontSize="small" />
          </IconButton>
          {/** 最小化 */}
          <IconButton size="small" color="inherit" aria-label="minimum" onClick={handleMin}>
            <MinimizeIcon fontSize="small" />
          </IconButton>
          {/** 最大化 */}
          <IconButton size="small" color="inherit" aria-label="maximize" onClick={handleMax}>
            <MaximizeIcon fontSize="small" />
          </IconButton>
          {/** アプリ終了（右端に8px余白） */}
          <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleExit}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

      </Toolbar>

      {/** タイトルバー下のメインエリア（左メニュー＋コンテンツ） */}
      <div id="mainArea">
        {/** 左メニュー部 */}
        <Menu />
        {/** メイン表示 */}
        <Content />
      </div>

      {/** コミットモーダル */}
      <CommitModal open={commitModalOpen} onClose={() => setCommitModalOpen(false)} />

      {/** 設定モーダル */}
      <SettingModal open={settingModalOpen} onClose={() => setSettingModalOpen(false)} />

      {/** バインダー編集モーダル */}
      <BinderModal open={binderModalOpen} onClose={() => setBinderModalOpen(false)} />

      {/** 別コンポーネントメッセージ */}
      <SystemMessage />
    </div>
  );
}

/**
 * コンポーネント非表示
 * @returns
 */
export function Hidden() {
  return <></>;
}

/**
 * 各種モード
 */
export const Mode = Object.freeze({
    template: 'template',
    asset: 'asset',
    note: 'note',
    diagram: 'diagram',
})

export default App
