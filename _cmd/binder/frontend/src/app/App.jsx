import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import Menu from './Menu.jsx';
import Content from './Content.jsx';
import CommitModal from '../dialogs/CommitModal.jsx';
import PublishModal from '../dialogs/PublishModal.jsx';
import SettingModal from '../dialogs/SettingModal.jsx';
import BinderModal from '../dialogs/BinderModal.jsx';
import PushModal from '../dialogs/PushModal.jsx';
import MergeModal from '../dialogs/MergeModal.jsx';
import BranchHistoryModal from './BranchHistoryModal.jsx';

import { Box, Toolbar, Typography, IconButton, Tooltip } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import PushPinIcon from '@mui/icons-material/PushPin';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseIcon from '@mui/icons-material/Close';

import { Events, Window } from '@wailsio/runtime';
import { GetPath, GetConfig, GetVersionInfo, CloseBinder, LoadBinder, CheckCompat, Convert } from '../../bindings/binder/api/app';
import { SavePosition, Terminate, OpenSyslogWindow } from '../../bindings/main/window';

import Event, { EventContext } from "../Event";
import { SystemMessage } from '../Message';
import ConvertDialog, { NeedUpdateDialog } from '../dialogs/components/ConvertDialog';
import MarkedScript from '../components/editor/engines/Marked';
import MermaidScript from '../components/editor/engines/Mermaid';

import '../assets/App.css';
import "../language";
import { useTranslation } from 'react-i18next'

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

  const {t} = useTranslation();

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const location = useLocation();

  // 非テンプレートエディタルートでのみサイドバートグルを表示する
  const isNonTemplateEditor = /^\/editor\/(?!template)/.test(location.pathname);

  // バインダー未選択画面（履歴、新規作成、リモート）かどうか
  const isBinderOpenScreen = ['/', '/file/new', '/file/remote'].includes(location.pathname);

  //文書名（ページタイトル: ノート名・画面名など）
  const [pageTitle, setPageTitle] = useState("");
  //開いているBinder名
  const [binderName, setBinderName] = useState("");
  //アプリバージョンラベル（バインダー未選択画面で表示）
  const [appVersionLabel, setAppVersionLabel] = useState("Binder");
  const [pin, setPin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishModalTemplate, setPublishModalTemplate] = useState(null);
  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [binderModalOpen, setBinderModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [needUpdateOpen, setNeedUpdateOpen] = useState(false);
  const [pendingDir, setPendingDir] = useState("");
  const [compatVersions, setCompatVersions] = useState({ appVersion: "", binderVersion: "" });
  const [devMode, setDevMode] = useState(false);

  // CompatStatus 定数（Go 側の CompatStatus と一致）
  const CompatOK = 0;
  const CompatNeedConvert = 1;
  const CompatNeedUpdate = 2;

  // バインダーを開く共通処理（CheckCompat付き）
  const openBinder = (dir) => {
    CheckCompat(dir).then((result) => {
      setCompatVersions({ appVersion: result.appVersion, binderVersion: result.binderVersion });
      switch (result.status) {
        case CompatNeedConvert:
          setPendingDir(dir);
          setConvertOpen(true);
          break;
        case CompatNeedUpdate:
          setPendingDir(dir);
          setNeedUpdateOpen(true);
          break;
        default:
          loadBinder(dir);
          break;
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // LoadBinder を呼んでエディタに遷移する
  const loadBinder = (dir) => {
    // バインダー切り替え時にスクリプトエンジンをリセット（次回parseで新バインダーの設定で再初期化）
    MarkedScript.reset();
    MermaidScript.reset();
    LoadBinder(dir).then((href) => {
      evt.changeAddress(href);
      nav("/editor/note/index");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleConvertConfirm = () => {
    setConvertOpen(false);
    const dir = pendingDir;
    setPendingDir("");

    Convert(dir).then(() => {
      evt.showSuccessMessage(t("convert.success"));
      loadBinder(dir);
    }).catch((err) => {
      evt.showErrorMessage(t("convert.error", { error: err }));
    });
  };

  const handleConvertCancel = () => {
    setConvertOpen(false);
    setPendingDir("");
  };

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

    //公開一覧モーダルを開く
    evt.register("App", Event.OpenPublishModal, function (data) {
      setPublishModalTemplate(data ?? null);
      setPublishModalOpen(true);
    });

    //Pushモーダルを開く
    evt.register("App", Event.OpenPushModal, function () {
      setPushModalOpen(true);
    });

    //Mergeモーダルを開く
    evt.register("App", Event.OpenMergeModal, function () {
      setMergeModalOpen(true);
    });

    //ブランチ変更モーダルを開く
    evt.register("App", Event.OpenBranchModal, function () {
      setBranchModalOpen(true);
    });

    //バインダーを開く（CheckCompat付き）
    evt.register("App", Event.OpenBinder, function (dir) {
      openBinder(dir);
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

    // 検索ウィンドウからのナビゲーション通知
    const cleanupSearch = Events.On("binder:search:navigate", (event) => {
      const { typ, id, query } = event.data?.[0] ?? event.data ?? {};
      if (typ && id) {
        nav(`/editor/${typ}/${id}`, { state: { restoredAt: Date.now(), searchQuery: query || "" } });
        evt.selectTreeNode(id);
      }
    });

    //バインダーを開いたとき（アドレス変更時）にBinder名を再取得
    evt.register("App", Event.ChangeAddress, function () {
      loadBinderName();
    });

    //アプリバージョンを取得してタイトル用ラベルを生成
    GetVersionInfo().then((info) => {
      let label = "Binder " + info.version;
      if (info.dev) {
        label += " DEV";
      }
      setAppVersionLabel(label);
      setDevMode(info.dev);
    }).catch(() => {});

    //パス設定を取得し、「起動時にバインダーを開く」が有効かつ履歴があれば自動的に開く
    GetPath().then((path) => {
      if (path?.runWithOpen) {
        const h = path.histories;
        if (h && h.length > 0) {
          openBinder(h[0]);
        }
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

    const handleKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        OpenSyslogWindow().catch(() => {});
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cleanupRestored();
      cleanupSearch();
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
      setPageTitle("");
      setBinderName("");
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

          {/** ストレージボタン: バインダーを閉じてトップへ戻る */}
          <Tooltip title={t("app.home")} placement="right">
          <IconButton id="storageBtn" className={devMode ? "dev" : ""} size="small" color="inherit" aria-label="home" sx={{ mr: 1, ml: '-2px' }} onClick={handleClickHome}>
            <StorageIcon fontSize="small" />
          </IconButton>
          </Tooltip>

          <Typography variant="body1" component="div" noWrap>
            {isBinderOpenScreen ? appVersionLabel : binderName}
          </Typography>
          {/** サイドバー開閉: ツリー画面（非テンプレートエディタ）のみ表示 */}
          {isNonTemplateEditor && (
            <IconButton id="sidebarBtn" className={sidebarClass} size="small" color="inherit" aria-label="toggle sidebar" sx={{ ml: 1 }} onClick={() => evt.toggleSidebar()}>
              <ViewSidebarIcon fontSize="small" />
            </IconButton>
          )}
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

      {/** 公開一覧モーダル */}
      <PublishModal open={publishModalOpen} template={publishModalTemplate} onClose={() => { setPublishModalOpen(false); setPublishModalTemplate(null); }} />

      {/** 設定モーダル */}
      <SettingModal open={settingModalOpen} onClose={() => setSettingModalOpen(false)} />

      {/** バインダー編集モーダル */}
      <BinderModal open={binderModalOpen} onClose={() => setBinderModalOpen(false)} />

      {/** Pushモーダル */}
      <PushModal open={pushModalOpen} onClose={() => setPushModalOpen(false)} />

      {/** Mergeモーダル */}
      <MergeModal open={mergeModalOpen} onClose={() => setMergeModalOpen(false)} />

      {/** ブランチ変更 + 全体履歴モーダル */}
      <BranchHistoryModal open={branchModalOpen} onClose={() => setBranchModalOpen(false)} />

      {/** データ移行確認ダイアログ */}
      <ConvertDialog
        open={convertOpen}
        appVersion={compatVersions.appVersion}
        binderVersion={compatVersions.binderVersion}
        onCancel={handleConvertCancel}
        onConfirm={handleConvertConfirm}
      />

      {/** アプリ更新が必要なダイアログ */}
      <NeedUpdateDialog
        open={needUpdateOpen}
        appVersion={compatVersions.appVersion}
        binderVersion={compatVersions.binderVersion}
        onClose={() => { setNeedUpdateOpen(false); setPendingDir(""); }}
        onForceOpen={() => {
          setNeedUpdateOpen(false);
          const dir = pendingDir;
          setPendingDir("");
          loadBinder(dir);
        }}
      />

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
