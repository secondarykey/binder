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
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseIcon from '@mui/icons-material/Close';

import { Events, Window } from '@wailsio/runtime';
import { GetPath, GetConfig, GetVersionInfo, CloseBinder, LoadBinder, CheckCompat, Convert, SaveLastData, GetAutoSave, AutoSave, GetModifiedIds } from '../../bindings/binder/api/app';
import { SavePosition, Terminate, OpenSyslogWindow } from '../../bindings/main/window';

import Event, { EventContext } from "../Event";
import { SystemMessage } from '../Message';
import ConvertDialog, { NeedUpdateDialog, TooOldDialog } from '../dialogs/components/ConvertDialog';
import MarkedScript from '../components/editor/engines/Marked';
import { editorHistory } from '../components/editor/Component';
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
var autoSaveIntervalId = undefined;
// 自動保存ループの世代トークン（非同期セットアップのレース対策）
var autoSaveGen = 0;

/**
 * バインダーごとの最後に開いたデータをメモリ上で保持する。
 * アプリ実行中のみ有効（永続化しない）。
 */
const binderLastData = new Map();
let currentBinderDir = null;

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
  const [commitModalFilter, setCommitModalFilter] = useState(null);
  // 閉じる確認モーダル経由で実行する保留中のアクション（'exit' | 'home' | null）
  const [pendingClose, setPendingClose] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishModalTemplate, setPublishModalTemplate] = useState(null);
  const [publishModalSubtree, setPublishModalSubtree] = useState(null);
  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [binderModalOpen, setBinderModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [needUpdateOpen, setNeedUpdateOpen] = useState(false);
  const [tooOldOpen, setTooOldOpen] = useState(false);
  const [pendingDir, setPendingDir] = useState("");
  const [compatVersions, setCompatVersions] = useState({ appVersion: "", binderVersion: "", minAppVersion: "" });
  // 起動時の自動オープン判定が終わるまで true。履歴一覧の一瞬の表示（チラつき）を隠す
  const [booting, setBooting] = useState(true);
  const [devMode, setDevMode] = useState(false);

  // CompatStatus 定数（Go 側の CompatStatus と一致）
  const CompatOK = 0;
  const CompatNeedConvert = 1;
  const CompatNeedUpdate = 2;
  const CompatVersionOnly = 3;
  const CompatTooOld = 4;
  const CompatNotBinder = 5;

  // バインダーを開く共通処理（CheckCompat付き）
  // openLastData=true の場合、起動後に前回開いたデータに遷移する
  const openBinder = (dir, openLastData = false) => {
    CheckCompat(dir).then((result) => {
      setCompatVersions({ appVersion: result.appVersion, binderVersion: result.binderVersion, minAppVersion: result.minAppVersion || "" });
      switch (result.status) {
        case CompatNotBinder:
          setBooting(false);
          evt.showErrorMessage(t("convert.notBinder"));
          break;
        case CompatNeedConvert:
          setBooting(false);
          setPendingDir(dir);
          setConvertOpen(true);
          break;
        case CompatNeedUpdate:
          setBooting(false);
          setPendingDir(dir);
          setNeedUpdateOpen(true);
          break;
        case CompatVersionOnly:
          // スキーマ移行不要なバージョンアップ: ダイアログなしで静かに更新して開く
          Convert(dir).then(() => {
            loadBinder(dir, openLastData);
          }).catch((err) => {
            setBooting(false);
            evt.showErrorMessage(err);
          });
          break;
        case CompatTooOld:
          setBooting(false);
          setTooOldOpen(true);
          break;
        default:
          loadBinder(dir, openLastData);
          break;
      }
    }).catch((err) => {
      setBooting(false);
      evt.showErrorMessage(err);
    });
  };

  // 自動保存ループを（再）設定する。
  // 設定が有効な場合のみ、間隔（分）ごとに AutoSave を実行する。
  // バインダーが開かれている時だけ保存し、保存があればスナックバーで通知する。
  const setupAutoSave = () => {
    // 既存タイマーを破棄
    if (autoSaveIntervalId !== undefined) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = undefined;
    }
    // 世代トークン。GetAutoSave() が非同期で解決する間に再設定やアンマウントが
    // 起きた場合（StrictMode の二重マウント等）、古い呼び出しがタイマーを生成して
    // 追跡外で動き続ける（＝古い間隔が残る）のを防ぐ。
    const gen = ++autoSaveGen;
    GetAutoSave().then((a) => {
      // 自分より新しい設定呼び出し・アンマウントで世代が進んでいたら破棄
      if (gen !== autoSaveGen) return;
      if (!a || !a.enabled) return;
      const minutes = a.intervalMinutes > 0 ? a.intervalMinutes : 30;
      // 念のため二重生成を防ぐ
      if (autoSaveIntervalId !== undefined) {
        clearInterval(autoSaveIntervalId);
      }
      autoSaveIntervalId = setInterval(function () {
        if (!currentBinderDir) return;
        AutoSave().then((n) => {
          if (n > 0) {
            // ツリーの未記録強調・エディタのコミットボタンを更新
            evt.commitDone();
            evt.showSuccessMessage(t("setting.autoSaved", { num: n }));
          }
        }).catch(() => {
          // 自動保存の失敗はユーザ操作を妨げないため通知しない（syslogに記録される）
        });
      }, minutes * 60 * 1000);
    }).catch(() => {});
  };

  // LoadBinder を呼んでエディタに遷移する
  // openLastData=true の場合、前回開いたデータに遷移する
  const loadBinder = (dir, openLastData = false) => {
    // 切り替え前のバインダーの現在ページをメモリに保存
    if (currentBinderDir) {
      const m = location.pathname.match(/^\/editor\/([^/]+)\/(.+)$/);
      if (m) {
        const mode = m[1] === 'assets' ? 'asset' : m[1];
        binderLastData.set(currentBinderDir, { mode, id: m[2] });
      }
    }

    // バインダー切り替え時にスクリプトエンジン・エディタ履歴をリセット
    MarkedScript.reset();
    MermaidScript.reset();
    editorHistory.clear();
    LoadBinder(dir).then((href) => {
      // marked エンジンを起動直後にバックグラウンドで先読み（ウォームアップ）。
      // 初回ノート描画のクリティカルパス上で init()（CDN/vendor 読込 + プラグイン適用）を
      // 走らせると数百ms かかるため、エディタのマウントと並行して温めておく。
      // バインダーロード後に呼ぶことで GetConfig / GetPlugins が現在のバインダーで解決する。
      MarkedScript.ensureInit().catch(() => {});
      evt.changeAddress(href);
      currentBinderDir = dir;

      // エディタ route へ遷移してからスプラッシュを解除する。
      // 解除を nav より前にすると、openLastData の非同期遷移までの間に
      // 履歴一覧（"/"）が一瞬見えてしまうため必ず nav の直後に解除する。
      const navEditor = (p) => {
        nav(p);
        setBooting(false);
      };

      // メモリ上の記録を優先し、なければ永続化された記録、それもなければindex
      // ナビゲート先を SaveLastData で同期し、histories[0] と lastNoteId の不整合を防ぐ
      const mem = binderLastData.get(dir);
      if (mem) {
        const urlType = mem.mode === 'asset' ? 'assets' : mem.mode;
        navEditor("/editor/" + urlType + "/" + mem.id);
        evt.selectTreeNode(mem.id);
        SaveLastData(mem.mode, mem.id).catch(() => {});
      } else if (openLastData) {
        GetPath().then((path) => {
          const dataType = path?.lastDataType;
          const dataId = path?.lastNoteId;
          if (dataType && dataId) {
            const urlType = dataType === 'asset' ? 'assets' : dataType;
            navEditor("/editor/" + urlType + "/" + dataId);
            evt.selectTreeNode(dataId);
          } else {
            navEditor("/editor/note/index");
            SaveLastData("note", "index").catch(() => {});
          }
        }).catch(() => {
          navEditor("/editor/note/index");
          SaveLastData("note", "index").catch(() => {});
        });
      } else {
        navEditor("/editor/note/index");
        SaveLastData("note", "index").catch(() => {});
      }
    }).catch((err) => {
      setBooting(false);
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
    evt.register("App", Event.OpenCommitModal, function (data) {
      setCommitModalFilter(data ?? null);
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

    //サブツリー公開モーダルを開く
    evt.register("App", Event.OpenPublishSubtreeModal, function (data) {
      setPublishModalSubtree(data ?? null);
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
          // 自動オープン: openBinder/loadBinder 側で booting を解除する
          openBinder(h[0], !!path.openWithItem);
          return;
        }
      }
      // 自動オープンしない場合は履歴一覧を表示する
      setBooting(false);
    }).catch((err) => {
      setBooting(false);
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

    // 自動保存ループを設定し、設定変更通知で再設定する
    setupAutoSave();
    const cleanupAutoSave = Events.On("binder:autosave:changed", () => {
      setupAutoSave();
    });

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
      cleanupAutoSave();
      // 世代を進めて、保留中の setupAutoSave().then がタイマーを生成しないようにする
      autoSaveGen++;
      if (autoSaveIntervalId !== undefined) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = undefined;
      }
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
  // バインダーを閉じてトップへ移動する（保存・確認を伴わない実処理）
  const closeAndGoHome = () => {
    CloseBinder().then(() => {
      setPageTitle("");
      setBinderName("");
      nav("/");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // 確認モード: 未記録の変更があれば確認モーダルを出し、無ければそのまま proceed する。
  // 変更が無いのに空の一覧モーダルを出す（コミットすると「変更なし」エラーになる）煩わしさを避ける。
  const confirmCloseOrProceed = (pending, proceed) => {
    GetModifiedIds().then((ids) => {
      if (ids && ids.length > 0) {
        setPendingClose(pending);
        setCommitModalFilter(null);
        setCommitModalOpen(true);
      } else {
        proceed();
      }
    }).catch(() => proceed());
  };

  const handleClickHome = () => {
    // ホームに戻る前に現在のバインダーの表示ページをメモリに保存
    if (currentBinderDir) {
      const m = location.pathname.match(/^\/editor\/([^/]+)\/(.+)$/);
      if (m) {
        const mode = m[1] === 'assets' ? 'asset' : m[1];
        binderLastData.set(currentBinderDir, { mode, id: m[2] });
      }
      currentBinderDir = null;
    }
    GetAutoSave().then((a) => {
      if (a && a.onLeave && a.confirmOnClose) {
        // 「一覧に戻る時に保存」が確認モード: 未記録があれば一覧を出し、無ければそのまま一覧へ
        confirmCloseOrProceed('home', closeAndGoHome);
        return;
      }
      if (a && a.onLeave) {
        // 「離れる時に保存」: 閉じる前に全体コミットする（current が nil になる前）
        AutoSave().then((n) => {
          if (n > 0) {
            evt.commitDone();
            evt.showSuccessMessage(t("setting.autoSaved", { num: n }));
          }
        }).catch(() => {}).finally(closeAndGoHome);
        return;
      }
      closeAndGoHome();
    }).catch(() => {
      closeAndGoHome();
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

  // アプリ終了（Go側で OnClose 等を処理）
  const doTerminate = () => {
    Terminate().catch((err) => {
      console.warn(err);
    });
  };

  //終了処理
  const handleExit = () => {
    GetAutoSave().then((a) => {
      if (a && a.onClose && a.confirmOnClose && currentBinderDir) {
        // 「終了時に保存」が確認モード: 未記録があれば一覧を出してから終了、無ければそのまま終了
        confirmCloseOrProceed('exit', doTerminate);
        return;
      }
      doTerminate();
    }).catch(() => {
      doTerminate();
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

          <Typography variant="body1" component="div" noWrap sx={{ cursor: 'default' }}>
            {isBinderOpenScreen ? appVersionLabel : binderName}
          </Typography>
          {/** サイドバー開閉: ツリー画面（非テンプレートエディタ）のみ表示 */}
          {isNonTemplateEditor && (
            <IconButton id="sidebarBtn" className={sidebarClass} size="small" color="inherit" aria-label="toggle sidebar" sx={{ ml: 1 }} onClick={() => evt.toggleSidebar()}>
              <ViewSidebarIcon fontSize="small" />
            </IconButton>
          )}
          {/** 履歴ナビゲーション: エディタ画面のみ表示 */}
          {isNonTemplateEditor && (
            <>
              <Tooltip title={t("editor.historyBack")} placement="bottom">
                <span>
                  <IconButton size="small" color="inherit" aria-label="history back"
                    disabled={!editorHistory.canGoBack()}
                    sx={{ ml: 0.5, padding: '4px', '&.Mui-disabled': { opacity: 0.3, color: 'inherit' } }}
                    onClick={() => {
                      const entry = editorHistory.goBack();
                      if (entry) {
                        const urlMode = entry.mode === 'asset' ? 'assets' : entry.mode;
                        nav("/editor/" + urlMode + "/" + entry.id);
                      }
                    }}
                  >
                    <ArrowBackIosNewIcon sx={{ fontSize: '14px' }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t("editor.historyForward")} placement="bottom">
                <span>
                  <IconButton size="small" color="inherit" aria-label="history forward"
                    disabled={!editorHistory.canGoForward()}
                    sx={{ padding: '4px', '&.Mui-disabled': { opacity: 0.3, color: 'inherit' } }}
                    onClick={() => {
                      const entry = editorHistory.goForward();
                      if (entry) {
                        const urlMode = entry.mode === 'asset' ? 'assets' : entry.mode;
                        nav("/editor/" + urlMode + "/" + entry.id);
                      }
                    }}
                  >
                    <ArrowForwardIosIcon sx={{ fontSize: '14px' }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>

        {/** 中央セクション: 文書名（ノート名・画面名） */}
        <Typography variant="body1" component="div" noWrap sx={{ textAlign: 'center', px: 1, cursor: 'default' }}>
          {pageTitle}
        </Typography>

        {/** 右セクション: ウィンドウ操作ボタン */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 2, mr: 0.5 }}>
          {/** ピン留め */}
          <IconButton id="pinBtn" className={pinClass} size="small" color="inherit" aria-label="pin" onClick={handlePin}>
            {pin
              ? <PushPinIcon fontSize="small" />
              : <PushPinOutlinedIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} />
            }
          </IconButton>
          {/** 最小化 */}
          <IconButton size="small" color="inherit" aria-label="minimum" onClick={handleMin}>
            <MinimizeIcon fontSize="small" />
          </IconButton>
          {/** 最大化 */}
          <IconButton size="small" color="inherit" aria-label="maximize" onClick={handleMax}>
            <CropSquareIcon sx={{ fontSize: '14px' }} />
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
        {/** メイン表示。起動時の自動オープン判定中はスプラッシュで覆い、履歴一覧のチラつきを防ぐ */}
        {booting ? (
          <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--bg-app)' }} />
        ) : (
          <Content />
        )}
      </div>

      {/** コミットモーダル */}
      <CommitModal open={commitModalOpen} filterIds={commitModalFilter} onClose={() => {
        setCommitModalOpen(false);
        setCommitModalFilter(null);
        // 閉じる確認モーダル経由（コミット成功でもキャンセルでも）保留中のアクションを実行
        if (pendingClose) {
          const action = pendingClose;
          setPendingClose(null);
          if (action === 'exit') {
            doTerminate();
          } else if (action === 'home') {
            closeAndGoHome();
          }
        }
      }} />

      {/** 公開一覧モーダル */}
      <PublishModal open={publishModalOpen} template={publishModalTemplate} filterIds={publishModalSubtree} onClose={() => { setPublishModalOpen(false); setPublishModalTemplate(null); setPublishModalSubtree(null); }} />

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

      {/** アプリが古すぎて開けないダイアログ */}
      <TooOldDialog
        open={tooOldOpen}
        appVersion={compatVersions.appVersion}
        minAppVersion={compatVersions.minAppVersion}
        onClose={() => setTooOldOpen(false)}
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
