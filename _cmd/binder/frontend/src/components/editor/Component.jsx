import { useState, useEffect, useLayoutEffect, useContext, useRef, useCallback, useMemo, memo } from "react"
import { useParams, useLocation, useNavigate } from "react-router";

import { Backdrop, Button, Dialog, DialogActions, DialogTitle, Paper } from "@mui/material";

import { GetNote, ParseNote, OpenNote, CreateNoteHTML } from "../../../bindings/binder/api/app";
import { GetDiagram, OpenDiagram, ParseDiagram } from "../../../bindings/binder/api/app";
import { GetTemplate, OpenTemplate, SaveTemplate } from "../../../bindings/binder/api/app";
import { GetHTMLTemplates, GetBinderTree } from "../../../bindings/binder/api/app";
import { GetAsset, Generate, GenerateAll, GetUnpublishedRefs, Unpublish, Commit, EnsureAddress, CollectExportDeps, GetConfig } from "../../../bindings/binder/api/app";
import { GetLayer } from "../../../bindings/binder/api/app";
import { GetModifiedIds } from "../../../bindings/binder/api/app";
import { GetFont, SaveFont, GetSnippets, GetEditor, SaveEditor, GetStructure, GetPreviewScrollbar, IsBinderTrusted } from "../../../bindings/binder/api/app";
import { RunEditor, OpenPreviewWindow, DownloadNote } from "../../../bindings/main/window";
import { Events, Browser } from '@wailsio/runtime';

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";
import EditorArea from "./EditorArea.jsx";
import SearchBar from "./SearchBar.jsx";
import Autocomplete from "./Autocomplete.jsx";
import { handleMarkdownEnter, handleMarkdownFormat, handleMarkdownTab, scrollCaretIntoView, linkFromPaste } from "@shared/editor/markdown-keys";
import { countChars } from "@shared/editor/char-count";
import { idInsertText, isInsideTemplate } from "./id-insert";
import { extractHeadings, findHeadingLine } from "@shared/editor/outline";
import { hasAlertsPlugin, alertInsertText } from "@shared/editor/alerts";
import { useAutocomplete } from "@shared/editor/useAutocomplete";
import { goTemplateCandidates } from "@shared/editor/go-template-candidates";
import { extractUuidsOnLine } from "@shared/editor/id-detect";
import { detectTemplateFunc } from "@shared/editor/template-detect";
import IdStatusBar from "./IdStatusBar.jsx";

import Event, { EventContext, useEventListener } from "../../Event.jsx";
import { ActionButton } from "../../dialogs/components/ActionButton";
import "../../language";
import { useTranslation } from 'react-i18next';

import HTMLFrame from "./HTMLFrame.jsx";
import PreviewContextMenu from "@shared/editor/PreviewContextMenu";
import { resolveBinderLink } from "./binder-link";
import { watchExternalEditor } from "./external-editor";
import { publishWarningMessage } from "../../publish-warning";
import { renderPublishItem, publishComment } from "../../publish-items";
import { usePublishRefsDialog } from "../../dialogs/PublishRefsDialog.jsx";
import { flattenNotes, flattenDiagrams } from "./tree-flatten";
import { editorHistory, editorHistoryURL, emitHistoryState } from "./editor-history";
import { tsvToMarkdownTable, detectTableAt } from "./table-markdown";
import { hasConflictMarkers, buildConflictHTML } from "./conflict-view";
import { extractMermaidErrorLine, runTemplatePreview } from "./preview-run";
import { writeFn } from "./editor-save";
import { downloadBlob, triggerTextDownload } from "./download";
import { attachDiagramPanZoom } from "./diagram-pan-zoom";
import { useEditorCandidates } from "./useEditorCandidates";
import { useSplitterDrag } from "./useSplitterDrag";
import EditorToolbar from "./EditorToolbar.jsx";
import PreviewToolbar from "./PreviewToolbar.jsx";
import ParseStatusBar, { ParseDialogs } from "./ParseStatusBar.jsx";
import '../../assets/Editor.css'
import { Mode, copyClipboard } from "../../app/App.jsx";

import CloseIcon from '@mui/icons-material/Close';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import FontDialog from "../../dialogs/FontDialog.jsx";
import TableDialog from "../../dialogs/TableDialog.jsx";

import BinderTree from "../../components/BinderTree.jsx";
import TemplateTree from "../../app/TemplateTree.jsx";
import AssetViewer from "../../components/AssetViewer.jsx";
import LayerEditor from "../../components/LayerEditor.jsx";
import CommitBar from "../../components/CommitBar.jsx";

// 打鍵ごとの text 更新による再レンダリングから遮断する。
// ツリーは props を受け取らず内部 state + イベントバスで更新されるため、
// memo 化で数百 TreeItem の再描画がキー入力のたびに走るのを防げる
const MemoBinderTree = memo(BinderTree);
const MemoTemplateTree = memo(TemplateTree);
const MemoAutocomplete = memo(Autocomplete);
const MemoIdStatusBar = memo(IdStatusBar);
const MemoCommitBar = memo(CommitBar);

// テンプレートプレビューで前回選択したノート・テンプレート・ダイアグラムを記憶する
let lastPreviewNoteId = "";
let lastPreviewOtherTemplateId = "";
let lastPreviewDiagramId = "";

/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 *
 * レイアウト:
 *   #splitScreen (flex row)
 *     ├── #editorTreePanel   ← BinderTree（template以外）
 *     ├── #treeSplitter      ← ツリー幅調整
 *     └── #editorContent (flex row)
 *           ├── #editorWrapper   ← テキスト編集エリア
 *           ├── #splitter        ← エディタ/ビューア幅調整
 *           └── #dataViewer      ← HTML/Mermaidプレビュー
 */
function Editor(props) {

  var { mode, id } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const restoredAt = location.state?.restoredAt;
  const searchQuery = location.state?.searchQuery;
  const autoFocus = location.state?.autoFocus;
  const evt = useContext(EventContext)
  const {t} = useTranslation();

  const [editor, setEditor] = useState(true);
  const [viewer, setViewer] = useState(true);
  const [editorLocked, setEditorLocked] = useState(false);
  // 外部エディタのプロセスはすぐ終わったが、編集は続いているとみなしている間
  const [editorDetached, setEditorDetached] = useState(false);
  const externalEditorRef = useRef(null);
  useEffect(() => () => externalEditorRef.current?.stop(), []);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  // 行番号表示トグル
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  // テキスト折り返しトグル
  const [wordWrap, setWordWrap] = useState(true);
  // オートコンプリート設定
  const [autoComplete, setAutoComplete] = useState({
    template: true, idAssist: true, autoClose: true, funcHint: true, mermaid: true,
  });
  // テキスト検索バーの表示状態
  const [searchOpen, setSearchOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  // 検索でアクティブな行番号（1始まり、null = なし）
  const [activeMatchLine, setActiveMatchLine] = useState(null);

  // エディタ/ビューア間のスプリッター幅（エディタ側の幅）
  const [width, setWidth] = useState(500);
  // ツリーパネルの表示状態と幅
  const [treeVisible, setTreeVisible] = useState(true);
  const [treeWidth, setTreeWidth] = useState(250);

  const [fontDialog, setShowFontDialog] = useState(false);

  // テーブル編集ダイアログ
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableDialogLines, setTableDialogLines] = useState([]);
  const [tableRange, setTableRange] = useState({ start: 0, end: 0 });

  // スニペット
  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });

  // 囲み（GitHub Alerts）。プラグインが効いているときだけメニューを出す
  const [alertsAvailable, setAlertsAvailable] = useState(false);

  // 保存の状態（null: 開いたまま / saving: 保存待ち・保存中 / saved: 保存済み / error: 失敗）
  const [saveState, setSaveState] = useState(null);
  // 最後に頼んだ保存の番号。追い越された保存の結果で状態を書き換えないために使う
  const saveSeqRef = useRef(0);
  // 選んでいる範囲の文字数
  const [selectionChars, setSelectionChars] = useState(0);

  /**
   * テキストを保存し、保存の状態を表示に反映する。
   * writeFn はデバウンスされるため、追い越された呼び出しの Promise は完了しない。
   */
  const saveText = (m, i, txt) => {
    const seq = ++saveSeqRef.current;
    setSaveState("saving");
    const p = writeFn(m, i, txt);
    p.then(
      () => { if (saveSeqRef.current === seq) setSaveState("saved"); },
      () => { if (saveSeqRef.current === seq) setSaveState("error"); },
    );
    return p;
  };

  // 開くものが変わったら、保存の状態と選択の文字数を戻す
  useEffect(() => {
    saveSeqRef.current++;
    setSaveState(null);
    setSelectionChars(0);
  }, [mode, id]);

  // ページ全体の文字数
  const totalChars = useMemo(() => countChars(text), [text]);

  // カーソル行の UUID に対応する Structure 情報（複数対応）
  const [cursorStructures, setCursorStructures] = useState([]);
  const [cursorStructureIndex, setCursorStructureIndex] = useState(0);
  const idDetectTimerRef = useRef(null);
  const lastDetectedUuidsRef = useRef(null);
  // テンプレート関数ヒント
  const [funcHint, setFuncHint] = useState(null);

  // IME リセット用の hidden input への ref（ウィンドウ再アクティブ時に中継フォーカスとして使う）
  const hiddenFocusRef = useRef(null);

  // useEffect([]) 内など古いクロージャから最新の mode/id/name/html を参照するための ref
  const modeRef = useRef(mode);
  const idRef = useRef(id);
  const nameRef = useRef(name);
  const htmlRef = useRef("");
  // ダイアグラムテンプレートの初回描画済みIDを記録（非同期レース対策）
  const diagramInitializedRef = useRef(null);
  // ファイルオープン中フラグ（カーソル/スクロール位置リセット用）
  const fileOpeningRef = useRef(false);
  // 非同期ロード前のリセット中フラグ（空テキストでのparseText発火を抑制）
  const loadingRef = useRef(false);
  // 開き終えた回数。同じ種類のまま開き直すときは前の本文を出したままにする（空を挟むと点滅する）ので、
  // 本文が前と同じでも描画し直せるよう、useEffect([text]) をこれでも起こす
  const [openSeq, setOpenSeq] = useState(0);
  // 直前に開いていたものの種類（種類が変わるときだけ本文を空に戻す）
  const openedModeRef = useRef(null);
  useEffect(() => {
    modeRef.current = mode;
    setCursorStructures([]); setCursorStructureIndex(0); lastDetectedUuidsRef.current = null;
  }, [mode]);
  useEffect(() => {
    idRef.current = id;
    setCursorStructures([]); setCursorStructureIndex(0); lastDetectedUuidsRef.current = null;
    if (!editorHistory.navigating) {
      editorHistory.push(mode, id);
    }
    editorHistory.navigating = false;
    emitHistoryState();
  }, [id]);
  useEffect(() => { nameRef.current = name; }, [name]);

  // ユーザーがテキストを入力中かどうかのフラグ / デバウンスタイマー
  // handleChangeText だけが true にセットする。ファイルオープン時はセットされないので即時描画になる。
  const isEditingRef = useRef(false);
  const parseTimerRef = useRef(null);

  // カーソル行（1始まり）- handleChangeText で更新し parseText で HTMLFrame に渡す
  const cursorLineRef = useRef(1);
  const composingRef = useRef(false);
  const [cursorLine, setCursorLine] = useState(1);

  // プレビューのスクロールバーをエディタ画面と揃えるか（アプリ設定・デフォルトON）
  const [previewScrollbar, setPreviewScrollbar] = useState(true);
  const [allowScripts, setAllowScripts] = useState(false);
  // 表示中のプレビューでスクリプトを止めたか（止めたときだけアイコンを出す）
  const [scriptsBlocked, setScriptsBlocked] = useState(false);

  // オートコンプリートの挿入処理
  const handleAutocompleteSelect = useCallback((trigger, selected, replaceStart, replaceEnd) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(replaceStart, replaceEnd);
    // replaceStart がトリガー文字列の位置かどうかで挿入テキストを分岐
    const atTrigger = textarea.value.substring(replaceStart, replaceStart + trigger.length) === trigger;
    let insertText;
    let cursorOffset = 0;
    if (atTrigger) {
      const filterText = textarea.value.substring(replaceStart + trigger.length, replaceEnd);
      const leadingSpaces = filterText.match(/^(\s*)/)[1];
      insertText = trigger + leadingSpaces + selected;
    } else {
      insertText = selected;
    }
    if (trigger === '"') {
      // ID候補選択時: 閉じ引用符を追加し、既存の閉じ引用符があればスキップ
      insertText = '"' + selected + '"';
      const afterEnd = textarea.value.charAt(replaceEnd);
      if (afterEnd === '"') {
        textarea.setSelectionRange(replaceStart, replaceEnd + 1);
      }
    } else if (trigger === '{{' && atTrigger) {
      // ブロックキーワード選択時: 閉じタグを自動挿入
      const candidate = goTemplateCandidates.find(c => c.label === selected);
      if (candidate?.needsEnd && autoComplete.autoClose) {
        const closing = ' }} {{end}}';
        insertText += closing;
        cursorOffset = -closing.length;
      }
    }
    document.execCommand('insertText', false, insertText);
    if (cursorOffset) {
      const pos = textarea.selectionStart + cursorOffset;
      textarea.setSelectionRange(pos, pos);
    }
    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(mode, id, textarea.value);
    });
  }, [mode, id, autoComplete.autoClose]);

  // オートコンプリートの候補（テンプレート関数・フィールド・ID・Mermaid）
  const { resolvedCandidates, autocompleteTriggers } = useEditorCandidates({ mode, id, autoComplete, t });

  const ac = useAutocomplete({
    triggers: autocompleteTriggers,
    textareaSelector: '#editor',
    composingRef,
    onSelect: handleAutocompleteSelect,
  });

  const [editorFont, setEditorFont] = useState(undefined);
  const [editorStyle, setEditorStyle] = useState({});
  const editorSettingRef = useRef(null);

  // パースステータス（プレビュー下部のステータスバー用）
  const [parseStatus, setParseStatus] = useState({ status: "success", err: null, warnings: [] });
  const [parseErrorDlg, setParseErrorDlg] = useState(false);
  const [parseWarningDlg, setParseWarningDlg] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [alias, setAlias] = useState('');
  // ダイアグラムスタイルテンプレートID
  const [styleTemplateId, setStyleTemplateId] = useState("");

  // プレビューカラースキーム
  const [colorSchemeConfig, setColorSchemeConfig] = useState(null);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);

  //viewHTMLのprop
  const [html, setHTML] = useState("");
  useEffect(() => { htmlRef.current = html; }, [html]);
  //更新状態のアイコン
  const [updated, setUpdated] = useState(false);

  // テンプレートプレビュー用
  const [templateType, setTemplateType] = useState("");
  const [previewLayouts, setPreviewLayouts] = useState([]);
  const [previewContents, setPreviewContents] = useState([]);
  const [previewNotes, setPreviewNotes] = useState([]);
  const [previewNoteId, setPreviewNoteId] = useState("");
  const [previewOtherTemplateId, setPreviewOtherTemplateId] = useState("");
  // ダイアグラムテンプレートプレビュー用
  const [previewDiagrams, setPreviewDiagrams] = useState([]);
  const [previewDiagramId, setPreviewDiagramId] = useState("");

  // Ctrl+F で検索バーを開く、Ctrl+H で置換モードで開く
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(prev => {
          if (!prev) { setReplaceMode(false); return true; }
          if (replaceMode) { setReplaceMode(false); return true; }
          return false;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setSearchOpen(prev => {
          if (!prev) { setReplaceMode(true); return true; }
          if (!replaceMode) { setReplaceMode(true); return true; }
          return false;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [replaceMode]);

  // Alt+← / Alt+→ でエディタ履歴ナビゲーション
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      let entry = null;
      if (e.key === 'ArrowLeft') {
        entry = editorHistory.goBack();
      } else if (e.key === 'ArrowRight') {
        entry = editorHistory.goForward();
      }
      if (entry) {
        e.preventDefault();
        nav(editorHistoryURL(entry));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [nav]);

  // 検索結果クリック時にテキストエリアの該当箇所へ移動・選択
  const handleSearchNavigate = useCallback((absoluteStart, absoluteEnd) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    const linesBefore = text.substring(0, absoluteStart).split('\n').length - 1;
    setActiveMatchLine(linesBefore + 1);
    // カーソルをマッチ位置に移動する。
    // ブラウザは「カーソル位置へスクロール」するため、カーソルをマッチ位置に
    // 置くことでスクロール先を正しい位置に誘導する。
    textarea.setSelectionRange(absoluteStart, absoluteStart);
    const totalLines = text.split('\n').length;
    const lineHeight = totalLines > 0 ? textarea.scrollHeight / totalLines : 20;
    textarea.scrollTop = Math.max(0, linesBefore * lineHeight - textarea.clientHeight / 3);
  }, [text]);

  const handleReplace = useCallback((absoluteStart, absoluteEnd, replacement) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(absoluteStart, absoluteEnd);
    document.execCommand('insertText', false, replacement);
    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(mode, id, textarea.value);
    });
  }, [mode, id]);

  const handleReplaceAll = useCallback((matches, replacement) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.focus();
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      newText = newText.substring(0, m.absoluteStart) + replacement + newText.substring(m.absoluteEnd);
    }
    textarea.select();
    document.execCommand('insertText', false, newText);
    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(mode, id, textarea.value);
    });
  }, [text, mode, id]);

  useEffect(() => {
    GetConfig().then((conf) => {
      if (conf.previewColorScheme) {
        setColorSchemeConfig(conf.previewColorScheme);
      }
    }).catch(() => {});
  }, []);

  //開いた時の初期処理
  useEffect(() => {

    // モード切替時のエディタ/ビューア開閉でアニメーションさせない
    const editorContentEl = document.getElementById('editorContent');
    editorContentEl?.classList.add('no-transition');

    evt.clearMessage();
    // モード/ID切替時に前回のデバウンスタイマーをクリア（stale closure 防止）
    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
      parseTimerRef.current = null;
    }
    // ツリー選択を同期（画像貼り付け・ツリー展開に必要）
    evt.selectTreeNode(id);

    if (mode === Mode.diagram) {

      setEditor(true);
      // assets/layer モードから戻った場合に viewer 状態を復元する
      if (editorSettingRef.current) {
        setViewer(editorSettingRef.current.showPreview);
      }
      // モード切替後に #mermaidViewer が再マウントされるため、text を一旦クリアして
      // 非同期ロード完了時に必ず useEffect([text]) が発火するようにする
      loadingRef.current = true;
      setParseStatus({ status: "processing", err: null, warnings: [] });
      // 図から図へ移るときは前の本文と図を出したままにし、読み終えてから差し替える
      if (openedModeRef.current !== Mode.diagram) setText("");

      // メタ情報取得 → スタイルテンプレートキャッシュ → テキスト設定の順に実行
      // setText が先に走ると styleTemplateId が空のまま初回描画されるため
      const metaReady = GetDiagram(id).then(async (resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setIsPrivate(!!resp.private);
        setAlias(resp.alias ?? '');
        setName(resp.name);
        setStyleTemplateId(resp.styleTemplate || "");
        if (resp.styleTemplate) {
          if (Mermaid.hasStyleTemplate(resp.styleTemplate)) {
            // キャッシュ済みなら描画をブロックせずバックグラウンドで最新内容に更新する
            OpenTemplate(resp.styleTemplate).then((content) => {
              Mermaid.setStyleTemplate(resp.styleTemplate, content);
            }).catch(() => {});
          } else {
            // 初回はスタイル欠落した描画を防ぐため取得完了を待つ
            const content = await OpenTemplate(resp.styleTemplate).catch(() => "");
            Mermaid.setStyleTemplate(resp.styleTemplate, content);
          }
        }
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      Promise.all([OpenDiagram(id), metaReady]).then(([diagramText]) => {
        // 読んでいる間に別のものを開いていたら捨てる
        if (idRef.current !== id) return;
        loadingRef.current = false;
        fileOpeningRef.current = true;
        if (diagramText === "") {
          setParseStatus({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });
          const mermaidEl = document.querySelector('#mermaidViewer');
          if (mermaidEl) mermaidEl.innerHTML = '';
        }
        setText(diagramText);
        setOpenSeq((n) => n + 1);
      }).catch((err) => {
        // 前の図の本文を、開けなかった図のものとして出したままにしない
        if (idRef.current === id) setText("");
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.note) {

      setEditor(true);
      // assets/layer モードから戻った場合に viewer 状態を復元する
      if (editorSettingRef.current) {
        setViewer(editorSettingRef.current.showPreview);
      }
      // ダイアグラム/テンプレートと同じリセットパターン。
      // これが無いと、マウント直後の parseText("") による空コンテンツエラーや
      // 前ファイルのエラー行ハイライトが、ロード完了までの間ガターに赤く残る
      loadingRef.current = true;
      setParseStatus({ status: "processing", err: null, warnings: [] });
      // ノートからノートへ移るときは前の本文とプレビューを出したままにし、読み終えてから差し替える
      // （空の本文を挟むと、エディタと行番号が一瞬消えて点滅して見える）
      if (openedModeRef.current !== Mode.note) setText("");

      OpenNote(id).then((resp) => {
        // 読んでいる間に別のものを開いていたら捨てる
        if (idRef.current !== id) return;
        loadingRef.current = false;
        fileOpeningRef.current = true;
        // プレビューは新しいノートの先頭から見せる
        cursorLineRef.current = 1;
        if (resp === "") {
          // ""→"" では useEffect([text]) が発火しないため、ここで直接確定する
          setParseStatus({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });
          setHTML("");
        }
        setText(resp);
        setOpenSeq((n) => n + 1);
      }).catch((err) => {
        // 前のノートの本文を、開けなかったノートのものとして出したままにしない
        if (idRef.current === id) setText("");
        evt.showErrorMessage(err);
      });

      GetNote(id).then((resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setIsPrivate(!!resp.private);
        setAlias(resp.alias ?? '');
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.template) {

      setEditor(true);
      // assets/layer モードから戻った場合に viewer 状態を復元する
      if (editorSettingRef.current) {
        setViewer(editorSettingRef.current.showPreview);
      }
      // プレビュー設定を初期化（前回の選択があれば復元）
      setHTML("");
      loadingRef.current = true;
      setParseStatus({ status: "processing", err: null, warnings: [] });
      setText("");                   // 非同期ロード前にリセット（初回描画ガード用）
      setTemplateType("");          // 前テンプレートの型が残ると stale preview が発生するためリセット
      setPreviewOtherTemplateId(""); // 同上
      diagramInitializedRef.current = null; // 同一IDへの再訪問に備えてリセット

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
        loadingRef.current = false;
        fileOpeningRef.current = true;
        if (resp === "") {
          setParseStatus({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });
        }
        setText(resp);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      GetTemplate(id).then((resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setName(resp.name);
        setTemplateType(resp.type);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      // プレビュー用データを取得（テンプレートタイプ確定後に分岐するため、ここではツリーとテンプレート一覧を両方取得）
      GetHTMLTemplates().then((tmpls) => {
        setPreviewLayouts(tmpls.layouts ?? []);
        setPreviewContents(tmpls.contents ?? []);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      GetBinderTree().then((tree) => {
        // ノート一覧（layout/content テンプレート用）
        const notes = flattenNotes(tree.data ?? []);
        setPreviewNotes(notes);
        if (notes.length > 0) {
          const restored = lastPreviewNoteId && notes.some(n => n.id === lastPreviewNoteId);
          setPreviewNoteId(restored ? lastPreviewNoteId : notes[0].id);
        }
        // ダイアグラム一覧（diagram テンプレート用）
        const diagrams = flattenDiagrams(tree.data ?? []);
        setPreviewDiagrams(diagrams);
        if (diagrams.length > 0) {
          const restored = lastPreviewDiagramId && diagrams.some(d => d.id === lastPreviewDiagramId);
          setPreviewDiagramId(restored ? lastPreviewDiagramId : diagrams[0].id);
        }
      }).catch((err) => {
        evt.showErrorMessage(err);
      });
    } else if (mode === "assets") {
      // AssetViewer コンポーネントが表示・操作を担うため editor/viewer は不要
      setEditor(false);
      setViewer(false);
      GetAsset(id).then((resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setIsPrivate(!!resp.private);
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    } else if (mode === "layer") {
      // LayerEditor コンポーネントが表示・操作を担うため editor/viewer は不要
      setEditor(false);
      setViewer(false);
      GetLayer(id).then((resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setIsPrivate(!!resp.private);
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    }

    openedModeRef.current = mode;

    // レイアウト反映後にtransitionを再有効化（二重rAFでReact再描画完了を待つ）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editorContentEl?.classList.remove('no-transition');
      });
    });

  }, [id, restoredAt]);

  // 検索ウィンドウからのナビゲーション: searchQuery があればエディタ内検索を自動で開く
  useEffect(() => {
    if (searchQuery) {
      setSearchOpen(true);
    }
  }, [searchQuery, restoredAt]);

  // ツリーでの名称決定後の遷移: autoFocus があればエディタへカーソルを当てる
  useEffect(() => {
    if (!autoFocus) return;
    requestAnimationFrame(() => {
      document.querySelector("#editor")?.focus();
    });
  }, [autoFocus, id]);

  // ノートが切り替わったら行ハイライトをリセット
  useEffect(() => {
    setActiveMatchLine(null);
  }, [id]);

  // プレビューウィンドウからの準備完了通知を受けて現在のHTMLを送信
  useEffect(() => {
    const cleanup = Events.On('binder:preview:ready', () => {
      Events.Emit('binder:preview:update', {
        typ: modeRef.current, id: idRef.current, name: nameRef.current, html: htmlRef.current,
      });
      // 後から開いたプレビューウィンドウにも現在の履歴の可否を渡す
      emitHistoryState();
    });
    return () => { cleanup(); };
  }, []);

  // 設定画面からのエディタ設定変更を同期
  useEffect(() => {
    const cleanup = Events.On('binder:editor:settingChanged', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      setShowLineNumbers(data.showLineNumbers);
      setWordWrap(data.wordWrap);
      setViewer(data.showPreview);
      if (data.autoComplete !== undefined && typeof data.autoComplete === 'object') {
        setAutoComplete(data.autoComplete);
      }
      // editorSettingRef も更新
      if (editorSettingRef.current) {
        editorSettingRef.current = { ...editorSettingRef.current, ...data };
      }
    });
    return () => { cleanup(); };
  }, []);

  // 設定画面からのフォント変更を同期
  useEffect(() => {
    const cleanup = Events.On('binder:editor:fontChanged', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      settingFont(data, false);
    });
    return () => { cleanup(); };
  }, []);

  // スニペットを一度だけロード
  useEffect(() => {
    GetSnippets().then((s) => setSnippets(s)).catch(() => { });
  }, []);

  // プレビューのスクロールバー設定（デフォルトON）を取得し、設定画面からの変更を同期
  useEffect(() => {
    GetPreviewScrollbar().then((v) => setPreviewScrollbar(!!v)).catch(() => { });
    const cleanup = Events.On('binder:preview:scrollbarChanged', (event) => {
      const data = event.data?.[0] ?? event.data;
      setPreviewScrollbar(!!data);
    });
    return () => { cleanup(); };
  }, []);

  // プレビューでスクリプトを動かすか（信頼したバインダーだけ。バインダー設定からの変更を同期）
  useEffect(() => {
    IsBinderTrusted().then((v) => setAllowScripts(!!v)).catch(() => { });
    const cleanup = Events.On('binder:preview:trustChanged', (event) => {
      const data = event.data?.[0] ?? event.data;
      setAllowScripts(!!data);
    });
    return () => { cleanup(); };
  }, []);

  // templateType が確定したら「もう一方のテンプレート」のデフォルトを設定（前回選択があれば復元）
  useEffect(() => {
    if (!templateType) return;
    const others = templateType === "layout" ? previewContents : previewLayouts;
    if (others.length > 0) {
      const restored = lastPreviewOtherTemplateId && others.some(t => t.id === lastPreviewOtherTemplateId);
      setPreviewOtherTemplateId(restored ? lastPreviewOtherTemplateId : others[0].id);
    }
  }, [templateType, previewLayouts, previewContents]);

  // プレビュー設定が揃ったら自動プレビュー（layout/content テンプレート）
  useEffect(() => {
    if (mode !== Mode.template || templateType === "diagram" || !previewNoteId || !previewOtherTemplateId || !templateType) return;
    runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
      .then((result) => {
        const ws = result.warnings || [];
        if (result.error) {
          evt.showErrorMessage(result.error);
        } else {
          setHTML(result.html);
          setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
          Events.Emit('binder:preview:update', { typ: 'template', id, name, html: result.html });
        }
      })
      .catch((err) => evt.showErrorMessage(err));
  }, [previewNoteId, previewOtherTemplateId]);

  // ダイアグラムテンプレート: 初回表示（text/templateType/previewDiagramId の非同期到達レース解消）
  // text が最後に届くケースも含めて全条件が揃った瞬間に一度だけ描画する
  useEffect(() => {
    if (mode !== Mode.template || templateType !== "diagram" || !previewDiagramId || !text) return;
    if (diagramInitializedRef.current === id) return;
    diagramInitializedRef.current = id;
    viewDiagramTemplatePreview(text, previewDiagramId);
  }, [previewDiagramId, templateType, text]);

  // ダイアグラムテンプレート: 選択ダイアグラム変更時の再描画（初回ロード完了後のみ）
  useEffect(() => {
    if (mode !== Mode.template || templateType !== "diagram" || !previewDiagramId || !text) return;
    if (diagramInitializedRef.current !== id) return;
    viewDiagramTemplatePreview(text, previewDiagramId);
  }, [previewDiagramId]);

  // モードに対応するスニペット一覧
  const snippetList = (() => {
    if (mode === Mode.note) return [...(snippets.markdowns ?? []), ...(snippets.templates ?? [])];
    if (mode === Mode.diagram) return snippets.diagrams ?? [];
    if (mode === Mode.template) return snippets.templates ?? [];
    return [];
  })();

  /**
   * スニペットをカーソル位置に挿入
   * ボタン・MenuItem の onMouseDown で preventDefault することでフォーカスを
   * textarea に保持したまま selectionStart/End を直接読み取る。
   */
  const handleInsertSnippet = (body) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, body);
    // execCommand は同期で textarea.value を確定するため、次フレームで state へ反映すれば足りる
    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(mode, id, textarea.value);
    });
  };

  /**
   * ID一覧で選んだものを入れる。
   * ノートの本文では種類に合わせたテンプレート関数まで入れ、{{ }} の中では ID だけを入れる。
   */
  const handleInsertId = (item) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const withFunc = mode === Mode.note && !isInsideTemplate(textarea.value, textarea.selectionStart);
    handleInsertSnippet(idInsertText(item, withFunc));
  };

  /**
   * 指定した行の先頭へカーソルを移し、その行を上端近くに見せる。
   * follow が true ならプレビューもその行へ追従させる
   * （プレビューの見出しから飛んだときは、押したところが動かないよう追従させない）。
   */
  const jumpToLine = (line, follow) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    const n = Math.min(Math.max(line, 1), lines.length);
    let pos = 0;
    for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(pos, pos);
    scrollCaretIntoView(textarea, { top: true });
    cursorLineRef.current = n;
    if (follow) setCursorLine(n);
    detectIdAtCursor(textarea.value, pos);
    setSelectionChars(0);
  };

  /**
   * プレビューの見出しが押されたら、エディタでその見出しの行へ飛ぶ
   */
  const handlePreviewHeadingClick = (target) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const line = findHeadingLine(extractHeadings(textarea.value), target);
    if (line) jumpToLine(line, false);
  };

  /**
   * 囲み（> [!NOTE] など）を入れる。選んでいる行があればそれを囲む
   */
  const handleInsertAlert = (type) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    handleInsertSnippet(alertInsertText(value, start, end, type));
  };

  /**
   * プレビューのブロックがダブルクリックされたら、エディタでその行へ飛ぶ
   */
  const handlePreviewBlockDoubleClick = (line) => jumpToLine(line, false);

  // エディタへのテキスト挿入イベントを購読
  // BinderTree などから {{assetImage "id"}} などのテキストをカーソル位置に挿入する
  useEventListener(Event.InsertText, (text) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, text);

    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(modeRef.current, idRef.current, textarea.value);
    });
  });

  // エディタへの OS ファイルドロップ: Go ハンドラ (main.go) がアセット登録後に
  // binder:filedrop:editor を発行するので、カーソル位置にアセット参照を挿入する
  useEffect(() => {
    return Events.On('binder:filedrop:editor', (event) => {
      const { nodeId, assets } = event.data ?? {};
      if (modeRef.current !== Mode.note || nodeId !== idRef.current || !assets?.length) return;
      const tags = assets.map((a) => a.mime?.startsWith('image/')
        ? `{{assetsImage "${a.id}" ""}}`
        : `{{assets "${a.id}"}}`);
      evt.insertText(tags.join('\n'));
    });
  }, []);

  // エディタへフォーカスを移すイベントを購読
  // BinderTree でのリネーム確定など、ナビゲーションを伴わないケースで使う
  useEventListener(Event.FocusEditor, () => {
    document.querySelector("#editor")?.focus();
  });

  //名称が変更になった場合の処理
  useEffect(() => {
    evt.changeTitle(name)
    setComment("Updated: " + name);
    if (name && id && mode) {
      Events.Emit('binder:preview:navigate', { typ: mode, id, name });
    }
  }, [name]);

  const parseText = async () => {
    if (text === "") {
      setParseStatus({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });
      setHTML("");
      const mermaidEl = document.querySelector('#mermaidViewer');
      if (mermaidEl) mermaidEl.innerHTML = '';
      return;
    }

    // 変換している間は前の表示を出したままにする（処理中であることはステータスバーに出る）。
    // 「Loading...」を挟むと、開くたび・挿入のたびにプレビューが点滅する
    setParseStatus({ status: "processing", err: null, warnings: [] });

    if (mode === Mode.diagram) {
      viewDiagram(text).catch((err) => {
        setParseStatus({ status: "error", err, warnings: [] });
        evt.showErrorMessage(err);
      });
    } else if (mode === Mode.note) {
      viewHTML(text).catch((err) => {
        setParseStatus({ status: "error", err, warnings: [] });
        evt.showErrorMessage(err);
      });
    } else if (mode === Mode.template) {
      if (templateType === "diagram") {
        // ダイアグラムテンプレート: 選択中のダイアグラムにテンプレートを適用して描画
        if (!previewDiagramId) return;
        viewDiagramTemplatePreview(text, previewDiagramId).catch((err) => {
          setParseStatus({ status: "error", err, warnings: [] });
          evt.showErrorMessage(err);
        });
      } else {
        if (!previewNoteId || !previewOtherTemplateId || !templateType) return;
        // テンプレートをファイルに即時保存してからプレビューを生成
        await SaveTemplate(id, text);
        runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
          .then((result) => {
            const ws = result.warnings || [];
            if (result.error) {
              setParseStatus({ status: "error", err: result.error, warnings: ws });
            } else {
              setHTML(result.html);
              setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
              Events.Emit('binder:preview:update', { typ: 'template', id, name, html: result.html });
            }
          })
          .catch((err) => setParseStatus({ status: "error", err, warnings: [] }));
      }
    } else {
      //初回時の実行があるか
    }
  }

  //テキスト変更時の処理
  // handleChangeText（ユーザー入力）→ isEditingRef=true → デバウンス
  // ファイルオープン時は isEditingRef が false のまま → 即時描画
  useEffect(() => {
    if (isEditingRef.current) {
      // ユーザーが入力中 → 500msデバウンスして描画
      isEditingRef.current = false;
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      parseTimerRef.current = setTimeout(() => { parseText().catch((err) => evt.showErrorMessage(err)); }, 500);
      return () => clearTimeout(parseTimerRef.current);
    }
    // 非同期ロード前のリセット中は parseText を呼ばない（フラッシュ防止）
    if (loadingRef.current) return;
    // ファイルオープン時（または挿入操作） → 即座に描画
    // 空テキストでも parseText を通してプレビューをクリアする
    // （ダイアグラム等で前の表示が残る問題の防止）

    // ファイルオープン時: カーソルを先頭に戻しスクロール位置をリセット
    // React の controlled textarea は value 更新時にカーソルを末尾に移動するため、
    // それによる自動スクロール（末尾へのジャンプ）を防ぐ
    if (fileOpeningRef.current) {
      fileOpeningRef.current = false;
      requestAnimationFrame(() => {
        const textarea = document.querySelector('#editor');
        if (textarea) {
          textarea.setSelectionRange(0, 0);
          textarea.scrollTop = 0;
        }
      });
    }

    parseText().catch((err) => evt.showErrorMessage(err));
  }, [text, openSeq]);

  // 開き終えたら、描画の前にカーソルとスクロールを先頭へ戻す
  // （前の本文を出したまま差し替えるので、描画のあとに戻すと前のスクロール位置が一瞬見える）
  useLayoutEffect(() => {
    if (!openSeq) return;
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.setSelectionRange(0, 0);
    textarea.scrollTop = 0;
  }, [openSeq]);

  //データをマークダウンからHTMLに変換
  // lineNumbers=true のとき parseWithSourceLines を使い data-src-line 属性を付与する（プレビュー用）
  const createMarked = async (id, txt, local, lineNumbers = false) => {
    var p = ""
    var parseError = false;
    var warnings = [];
    const result = await ParseNote(id, local, txt);
    if (result.error) {
      setParseStatus({ status: "error", err: result.error, errorLine: result.errorLine || 0, warnings: result.warnings || [] });
      parseError = true;
      p = txt;
    } else {
      p = result.html;
      warnings = result.warnings || [];
    }

    var val = lineNumbers ? await Marked.parseWithSourceLines(p) : await Marked.parse(p);
    // プラグインは描画の前に読み込まれるため、描画のたびに囲みのメニューを出すかを決め直す
    setAlertsAvailable(hasAlertsPlugin(Marked.getPluginStatus()));

    // エンジンとプラグインの失敗（CDN読込失敗・読込エラー・実行時例外・互換スキップ・
    // 未適用）を警告として拾う。互換層はプレビューを落とさないために失敗を握り潰すため、
    // ここで出さないとユーザは記法が黙って消えたことにしか気付けない。
    // parse 後に取るのは、実行時例外が parse 中に記録されるため。
    warnings = warnings.concat(Marked.getWarnings(t));

    return { html: val || "", parseError, warnings };
  }

  /**
   * HTMLの表示
   */
  const viewHTML = async (txt, embNoteElm) => {
    const _start = Date.now();

    if (mode === "note") {

      // マージコンフリクトマーカーが残っている間は marked を通さず、
      // 色分けしたコンフリクト表示に切り替える（エディタ側は変更しない）。
      if (hasConflictMarkers(txt)) {
        const conflictHtml = buildConflictHTML(txt, t('editor.conflictBanner'));
        setCursorLine(cursorLineRef.current);
        setHTML(conflictHtml);
        setParseStatus({ status: "warning", err: null, warnings: [t('editor.conflictBanner')] });
        Events.Emit('binder:preview:update', { typ: mode, id, name, html: conflictHtml });
        return;
      }

      var result = await createMarked(id, txt, true, true);
      const noteResult = await CreateNoteHTML(id, true, result.html);
      // 変換している間に別のものを開いていたら、前のノートの結果で表示を書き換えない
      if (idRef.current !== id) return;
      const allWarnings = [...(result.warnings || []), ...(noteResult.warnings || [])];
      if (noteResult.error) {
        setParseStatus({ status: "error", err: noteResult.error, warnings: allWarnings });
      } else {
        // カーソル行は HTML と同時に渡す（先に渡すと、差し替える前の表示がその行へ動いてしまう）
        setCursorLine(cursorLineRef.current);
        setHTML(noteResult.html);
        if (!result.parseError) {
          if (allWarnings.length > 0) {
            setParseStatus({ status: "warning", err: null, warnings: allWarnings });
          } else {
            setParseStatus({ status: "success", err: null, warnings: [], ms: Date.now() - _start });
          }
        }
        Events.Emit('binder:preview:update', { typ: mode, id, name, html: noteResult.html });
      }

    } else if (mode === "template") {
      //CreateTemplateHTML(id, txt, embNoteElm).then((resp) => {
      //setHTML(resp);
      //}).catch((err) => {
      //Event.showError(err);
      //})
    }
  }

  /**
   * ダイアグラムの表示
   */
  const viewDiagram = async (txt) => {
    const _start = Date.now();

    const diagramResult = await ParseDiagram(id, true, txt);
    if (diagramResult.error) {
      const elm = document.querySelector('#mermaidViewer');
      if (elm) elm.innerHTML = '';
      setParseStatus({ status: "error", err: diagramResult.error, errorLine: diagramResult.errorLine || 0, warnings: diagramResult.warnings || [] });
      return;
    }
    let parsedTxt = diagramResult.html;
    const diagWarnings = diagramResult.warnings || [];

    Mermaid.parse(parsedTxt, styleTemplateId).then((data) => {

      // 描いている間に別のものを開いていたら、前の図で表示を書き換えない
      if (idRef.current !== id) return;
      var elm = document.querySelector('#mermaidViewer');
      if (!elm) return;
      elm.innerHTML = data.svg;
      if (diagWarnings.length > 0) {
        setParseStatus({ status: "warning", err: null, warnings: diagWarnings });
      } else {
        setParseStatus({ status: "success", err: null, warnings: [], ms: Date.now() - _start });
      }
      Events.Emit('binder:preview:update', { typ: mode, id, name, html: parsedTxt, styleTemplateId });

      // 中ボタンのドラッグで移動、ホイールで拡大
      attachDiagramPanZoom(elm);

    }).catch((err) => {
      const elm = document.querySelector('#mermaidViewer');
      if (elm) elm.innerHTML = '';
      setParseStatus({ status: "error", err, errorLine: extractMermaidErrorLine(err), warnings: diagWarnings });
    });
  }

  /**
   * ダイアグラムテンプレートのプレビュー: 選択ダイアグラムにテンプレートを適用して描画
   */
  const viewDiagramTemplatePreview = async (templateText, diagramId) => {
    if (!diagramId || !templateText) return;
    OpenDiagram(diagramId).then(async (diagramContent) => {
      const parsedResult = await ParseDiagram(diagramId, true, diagramContent);
      const ws = parsedResult.warnings || [];
      if (parsedResult.error) {
        setParseStatus({ status: "error", err: parsedResult.error, warnings: ws });
        return;
      }
      let parsedContent = parsedResult.html;
      const prefix = `%%{init:${templateText}}%%\n`;
      const fullTxt = prefix + parsedContent;
      Mermaid.parse(fullTxt).then((data) => {
        var elm = document.querySelector('#mermaidViewer');
        if (elm) elm.innerHTML = data.svg;
        setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
        Events.Emit('binder:preview:update', { typ: 'diagram', id, name, html: fullTxt });
      }).catch((err) => {
        setParseStatus({ status: "error", err, warnings: ws });
      });
    }).catch((err) => {
      setParseStatus({ status: "error", err, warnings: [] });
    });
  }

  // ---- エディタ/ビューア間のスプリッター ----
  const splitter = useSplitterDrag({
    enabled: viewer, size: width, onCommit: setWidth, min: 100, containerId: 'editorContent',
    apply: (w) => {
      const wrapper = document.getElementById('editorWrapper');
      if (wrapper) wrapper.style.width = (w - 4) + 'px';
    },
  });

  // ---- ツリー/エディタ間のスプリッター ----
  const treeSplitter = useSplitterDrag({
    enabled: treeVisible, size: treeWidth, onCommit: setTreeWidth, min: 80, containerId: 'splitScreen',
    apply: (w) => {
      const panel = document.getElementById('editorTreePanel');
      if (panel) panel.style.width = w + 'px';
    },
  });


  /**
   * カーソル行の UUID を検出し、Structure 情報を取得する（デバウンス付き）
   */
  const detectIdAtCursor = useCallback((text, cursorPos) => {
    if (!autoComplete.idAssist) {
      // 毎キーストロークで新しい空配列を set すると不要な再レンダリングになる
      setCursorStructures((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const uuids = extractUuidsOnLine(text, cursorPos);
    const key = uuids.join(',');
    if (key === lastDetectedUuidsRef.current) return;
    lastDetectedUuidsRef.current = key;

    if (idDetectTimerRef.current) {
      clearTimeout(idDetectTimerRef.current);
    }

    if (uuids.length === 0) {
      setCursorStructures([]);
      setCursorStructureIndex(0);
      return;
    }

    idDetectTimerRef.current = setTimeout(() => {
      Promise.all(uuids.map((uuid) =>
        GetStructure(uuid).then((s) => s).catch(() => null)
      )).then((results) => {
        if (lastDetectedUuidsRef.current !== key) return;
        const found = results.filter(Boolean);
        setCursorStructures(found);
        setCursorStructureIndex(0);
      });
    }, 200);
  }, [autoComplete.idAssist]);

  const detectFuncHint = useCallback((text, cursorPos) => {
    if (!autoComplete.funcHint) {
      setFuncHint(null);
      return;
    }
    const result = detectTemplateFunc(text, cursorPos);
    if (!result) {
      setFuncHint(null);
      return;
    }
    const candidate = resolvedCandidates.find(c => c.label === result.name);
    if (!candidate) {
      setFuncHint(null);
      return;
    }
    // ブロックキーワード後の内部関数を検出
    if (candidate.needsEnd && result.argIndex >= 1 && result.tokens?.length > 0) {
      const innerName = result.tokens[0];
      const innerCandidate = resolvedCandidates.find(c => c.label === innerName);
      if (innerCandidate?.args) {
        setFuncHint({ ...innerCandidate, activeArg: result.argIndex - 1 });
        return;
      }
    }
    setFuncHint({ ...candidate, activeArg: result.argIndex });
  }, [resolvedCandidates, autoComplete.funcHint]);

  /**
   * カーソル移動時にプレビューのスクロール位置を追従させる + ID 検出
   */
  const handleCursorMove = useCallback((e) => {
    const textarea = e.target;
    const pos = textarea.selectionStart;

    if (modeRef.current === Mode.note) {
      const line = textarea.value.substring(0, pos).split('\n').length;
      if (line !== cursorLineRef.current) {
        cursorLineRef.current = line;
        setCursorLine(line);
      }
    }

    detectIdAtCursor(textarea.value, pos);
    detectFuncHint(textarea.value, pos);
    handleSelectionChange(e);
  }, [detectIdAtCursor]);

  /**
   * 選んでいる範囲の文字数を数え直す
   */
  const handleSelectionChange = useCallback((e) => {
    const textarea = e.target;
    const s = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelectionChars(end > s ? countChars(textarea.value.substring(s, end)) : 0);
  }, []);

  /**
   * テキストの変更
   */
  const handleChangeText = (e) => {

    // 開いている途中（前の本文を出したまま読んでいる間）の入力は受け付けない。
    // 受けると、前の本文に打った内容が新しく開く側の ID で保存されてしまう
    if (loadingRef.current) return;

    // ユーザー入力フラグを立てる（useEffect[text] でデバウンスを選択させる）
    isEditingRef.current = true;
    var txt = e.target.value;
    // カーソル行を記録（デバウンス後の parseText で使用する）
    const pos = e.target.selectionStart;
    cursorLineRef.current = txt.substring(0, pos).split('\n').length;
    setText(txt);
    detectIdAtCursor(txt, pos);
    detectFuncHint(txt, pos);
    ac.handleInput();

    setUpdated(true);
    saveText(mode, id, txt).then(() => {
      console.debug("Write!");
      // ダイアグラムスタイルテンプレートの保存時はエンジン側キャッシュも同期する
      if (mode === Mode.template && templateType === "diagram") {
        Mermaid.setStyleTemplate(id, txt);
      }
      evt.markModified(id);
      evt.markPublishDirty(id);
    }).catch((err) => {;
      evt.showErrorMessage(err);
    });
  }

  // プレビューのコンテキストメニュー（WebView既定のメニューは HTMLFrame 側で止めている）
  const [previewMenu, setPreviewMenu] = useState({ open: false, x: 0, y: 0, kind: null, href: '', selection: '' });
  // 履歴の可否はメニューを開いた時点の値で固定する（editorHistory は React の状態ではない）
  const handlePreviewContextMenu = (info) => setPreviewMenu({
    ...info,
    open: true,
    canBack: editorHistory.canGoBack(),
    canForward: editorHistory.canGoForward(),
  });
  const closePreviewMenu = () => setPreviewMenu((m) => ({ ...m, open: false }));

  // プレビューからの「戻る」は WebView のフレーム履歴ではなくエディタの閲覧履歴を辿る
  const handleHistoryBack = () => {
    const entry = editorHistory.goBack();
    if (entry) nav(editorHistoryURL(entry));
  };
  const handleHistoryForward = () => {
    const entry = editorHistory.goForward();
    if (entry) nav(editorHistoryURL(entry));
  };

  // プレビュー内の外部リンク: OSのブラウザで開く
  const handleLinkExternal = (url) => {
    Browser.OpenURL(url).catch((err) => evt.showErrorMessage(err));
  };

  // プレビュー内のバインダー内リンク: プレビューを遷移させず、そのエントリをエディタで開く
  const handleLinkInternal = (href) => {
    resolveBinderLink(href).then((target) => {
      if (!target) {
        evt.showWarningMessage(`${t("preview.linkNotFound")}: ${href}`);
        return;
      }
      nav(target.url);
      evt.selectTreeNode(target.id);
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleOpenInBrowser = () => {
    if (!alias) return;
    let path = null;
    if (mode === Mode.note) {
      path = id === "index" ? "/" : `/pages/${alias}.html`;
    } else if (mode === Mode.diagram) {
      path = `/images/${alias}.svg`;
    }
    if (!path) return;
    // HTTPサーバを遅延起動してから開く
    EnsureAddress().then((addr) => {
      if (addr) Browser.OpenURL(addr + path);
    }).catch((err) => evt.showErrorMessage(err));
  };

  // ノートの公開時に、まだ公開していない参照先を一緒に公開するかを聞くダイアログ
  const [publishRefsDialog, askPublishRefs] = usePublishRefsDialog();

  //出力処理
  const handlePublish = async () => {
    try {
      var elm = "";
      var pluginWarnings = [];
      // 一緒に公開する参照先（図・アセット・レイヤー）
      var refs = [];
      if (mode === Mode.note) {
        // 参照先を調べられなくても公開は止めない（公開時の警告で知らせる）
        const unpublished = await GetUnpublishedRefs(id, text).catch(() => []) ?? [];
        if (unpublished.length > 0) {
          refs = await askPublishRefs(unpublished);
          if (refs === null) return;
        }
        const markedResult = await createMarked(id, text, false);
        elm = markedResult.html;
        // 出力した HTML は git に記録されるため、エンジン／プラグインが効いていないまま
        // 出力したことに気付けるよう明示する（出力自体は止めない）。
        pluginWarnings = Marked.getWarnings(t);
      } else if (mode === Mode.diagram) {
        const diagResult = await ParseDiagram(id, false, text);
        if (diagResult.error) throw new Error(diagResult.error);
        var obj = await Mermaid.parse(diagResult.html, styleTemplateId);
        elm = obj.svg;
      } else if (mode === Mode.template) {
        elm = text;
      } else if (mode === Mode.asset) {
        elm = text;
      }

      // テンプレート関数の警告（未公開データの参照など）。公開後に 404 になる
      // 参照はプレビューでは見えないため、公開したこの時点で知らせる
      let genWarnings;
      if (refs.length > 0) {
        // ノートと参照先を 1 回の記録で公開する。同時に公開するもの同士は未公開の警告にならない
        const items = [{ mode: "note", id, data: elm }];
        for (const r of refs) {
          items.push(await renderPublishItem(r));
        }
        genWarnings = await GenerateAll(items, publishComment([{ type: "note", name }, ...refs]));
      } else {
        genWarnings = await Generate(mode, id, elm);
      }
      evt.reloadUnpublished();
      if (pluginWarnings.length > 0) {
        evt.showWarningMessage(t("plugin.warn.published", { count: pluginWarnings.length }));
      } else if (genWarnings?.length > 0) {
        evt.showWarningMessage(publishWarningMessage(t, genWarnings));
      } else {
        evt.showSuccessMessage("Generate.");
      }
    } catch (err) {
      evt.showErrorMessage(err);
    }
  }

  //非公開処理
  const [unpublishConfirm, setUnpublishConfirm] = useState(false);
  const handleUnpublish = () => setUnpublishConfirm(true);
  const doUnpublish = () => {
    setUnpublishConfirm(false);
    Unpublish(mode, id).then(() => {
      evt.reloadUnpublished();
      evt.showSuccessMessage("Unpublish.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  //個別コミットを行う
  // memo 化した CommitBar に渡すため参照を安定させる
  const handleCommit = useCallback(() => {
    Commit(mode, id, comment).then(() => {
      setUpdated(false);
      setComment("Updated: " + name);
      evt.commitDone();
      evt.showSuccessMessage("Commit.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }, [mode, id, comment, name, evt]);

  //SVG のダウンロードを行う
  const handleDownload = async () => {
    if (mode === Mode.diagram) {
      var elm = document.querySelector('#mermaidViewer');
      downloadBlob(elm.innerHTML, 'image/svg+xml', name + '.svg');
    } else if (mode === Mode.note) {
      downloadBlob(html, 'text/html', name + '.html');
    }
  }

  /** テキストをそのままダウンロード（テキストステートから直接） */
  const handleDownloadRaw = () => {
    if (mode === Mode.note) {
      triggerTextDownload(text, name + '.md');
    } else if (mode === Mode.diagram) {
      triggerTextDownload(text, name + '.mmd');
    }
  };

  /** テンプレート関数を展開したテキストをダウンロード（HTML変換前） */
  const handleDownloadExpanded = async () => {
    try {
      if (mode === Mode.note) {
        const result = await ParseNote(id, false, text);
        if (result.error) { evt.showErrorMessage(result.error); return; }
        triggerTextDownload(result.html, name + '.md');
      } else if (mode === Mode.diagram) {
        const result = await ParseDiagram(id, false, text);
        if (result.error) { evt.showErrorMessage(result.error); return; }
        triggerTextDownload(result.html, name + '.mmd');
      }
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  const handleDownloadZip = async () => {
    try {
      // 依存関係を収集（テンプレート関数展開のためMarkdownを渡す）
      const deps = await CollectExportDeps(id, text);
      const diagramSVGs = {};

      if (deps && deps.missingDiagrams && deps.missingDiagrams.length > 0) {
        for (const diag of deps.missingDiagrams) {
          try {
            const source = await OpenDiagram(diag.id);
            const expandResult = await ParseDiagram(diag.id, false, source);
            if (expandResult.error) throw new Error(expandResult.error);
            const diagMeta = await GetDiagram(diag.id);
            const result = await Mermaid.parse(expandResult.html, diagMeta.styleTemplate);
            if (result && result.svg) {
              diagramSVGs[diag.id] = result.svg;
            }
          } catch (diagErr) {
            console.warn("diagram SVG generation failed:", diag.id, diagErr);
          }
        }
      }

      const html = await Marked.parse(deps.expandedMarkdown);
      await DownloadNote(id, text, html, diagramSVGs);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  /**
   * ペースト処理: Excelなどからのタブ区切りデータをMarkdownテーブルに変換
   * タブ区切りと判定された場合、デフォルトのペースト（画像含む）をキャンセルし
   * Markdownテーブルとして挿入する
   */
  const handlePaste = (e) => {
    const plainText = e.clipboardData?.getData('text/plain');
    if (!plainText) return;

    // ノートで文字を選んで URL を貼ったら、選んだ文字をリンクにする
    if (mode === Mode.note) {
      const textarea = e.target;
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      const link = linkFromPaste(selected, plainText);
      if (link) {
        e.preventDefault();
        document.execCommand('insertText', false, link);
        isEditingRef.current = true;
        setText(textarea.value);
        saveText(mode, id, textarea.value);
        return;
      }
    }

    const markdown = tsvToMarkdownTable(plainText);
    if (!markdown) return;

    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const insertText = '\n' + markdown + '\n';
    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, insertText);

    isEditingRef.current = true;
    setText(textarea.value);
    saveText(mode, id, textarea.value);
  };

  /**
   * 文字列挿入
   * <pre>
   * s,e に挟んでテキストを挿入します。
   * sのみが指定された場合、改行前にその文字列を挿入します。
   * </pre>
   */
  const handleInsert = (s, e) => {
    if (composingRef.current) return;
    var textarea = document.querySelector("#editor");
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);

    var insertText;
    if (e !== undefined) {
      insertText = s + text + e;
    } else {
      var buf = "\n";
      const lines = text.split("\n");
      lines.forEach(line => {
        buf += s + line + "\n";
      });
      buf += "\n";
      insertText = buf;
    }

    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, insertText);

    requestAnimationFrame(function () {
      const val = textarea.value;
      setText(val);
      saveText(mode, id, val);
    })

  }

  /**
   * Enter時にインデントを挿入
   */
  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = true;
    // compositionend 直後の keydown（確定Enter）を無視するため、
    // 次のイベントループでフラグを落とす
    requestAnimationFrame(() => {
      composingRef.current = false;
    });
  };

  const handleIdNavigate = useCallback((urlMode, targetId) => {
    nav("/editor/" + urlMode + "/" + targetId);
  }, [nav]);

  const handleKeyDown = (e) => {
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    if (ac.handleKeyDown(e)) return;

    // Ctrl+Enter: IDステータスバーのアイテムへ遷移
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && cursorStructures.length > 0) {
      e.preventDefault();
      const s = cursorStructures[cursorStructureIndex] || cursorStructures[0];
      const urlMode = s.type === 'asset' ? 'assets' : s.type;
      handleIdNavigate(urlMode, s.id);
      return;
    }

    // Ctrl+B / Ctrl+I / Ctrl+K
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'k') {
        e.preventDefault();
        const textarea = e.target;
        const result = handleMarkdownFormat(textarea, key);
        if (result.handled) {
          textarea.value = result.value;
          textarea.selectionStart = result.selectionStart;
          textarea.selectionEnd = result.selectionEnd;
          isEditingRef.current = true;
          setText(result.value);
          saveText(mode, id, result.value);
          requestAnimationFrame(() => {
            textarea.selectionStart = result.selectionStart;
            textarea.selectionEnd = result.selectionEnd;
            scrollCaretIntoView(textarea);
          });
        }
        return;
      }
    }

    // Tab / Shift+Tab
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const textarea = e.target;
      const tabSize = editorSettingRef.current?.tabSize || 4;
      const result = handleMarkdownTab(textarea, e.shiftKey, tabSize);
      if (result.handled) {
        textarea.value = result.value;
        textarea.selectionStart = result.selectionStart;
        textarea.selectionEnd = result.selectionEnd;
        isEditingRef.current = true;
        setText(result.value);
        saveText(mode, id, result.value);
        requestAnimationFrame(() => {
          textarea.selectionStart = result.selectionStart;
          textarea.selectionEnd = result.selectionEnd;
          scrollCaretIntoView(textarea);
        });
      }
      return;
    }

    if (e.key !== "Enter") {
      return;
    }
    e.preventDefault();

    const textarea = e.target;
    const result = handleMarkdownEnter(textarea);

    if (result.handled) {
      textarea.value = result.value;
      textarea.selectionStart = result.cursor;
      textarea.selectionEnd = result.cursor;
      isEditingRef.current = true;
      setText(result.value);
      saveText(mode, id, result.value);
      requestAnimationFrame(() => {
        textarea.selectionStart = result.cursor;
        textarea.selectionEnd = result.cursor;
        scrollCaretIntoView(textarea);
      });
    }
  }

  /**
   * エディタを起動
   */
  const handleRunEditor = () => {

    setEditorLocked(true);

    // 外部エディタ起動中にファイル変更をポーリングして反映
    const openFn = mode === Mode.note ? OpenNote
                 : mode === Mode.diagram ? OpenDiagram
                 : mode === Mode.template ? OpenTemplate : null;

    externalEditorRef.current = watchExternalEditor({
      run: () => RunEditor(mode, id),
      read: openFn ? () => openFn(id) : null,
      initialText: text,
      onText: setText,
      onDetach: () => setEditorDetached(true),
      onFinish: () => {
        externalEditorRef.current = null;
        setEditorDetached(false);
        setEditorLocked(false);
      },
      onError: (err) => evt.showErrorMessage(err),
    });
  }

  /**
   * 起動だけしてすぐ終わる外部エディタでの編集を終える
   */
  const handleFinishExternalEditor = () => {
    externalEditorRef.current?.finish();
  }

  /**
   * フォントダイアログを表示
   */
  const handleFontDialog = () => {
    setShowFontDialog(true);
  }
  /**
   * フォントダイアログを終了
   */
  const handleFontDialogClose = (font) => {
    if (font !== undefined) {
      settingFont(font, true);
    }
    setShowFontDialog(false);
  }

  /**
   * テーブル編集ダイアログを起動
   */
  const handleTableEdit = () => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const result = detectTableAt(textarea.value, textarea.selectionStart);
    if (!result) {
      evt.showWarningMessage(t("editor.notInTable"));
      return;
    }
    setTableDialogLines(result.lines);
    setTableRange({ start: result.startOffset, end: result.endOffset });
    setTableDialogOpen(true);
  };

  /**
   * テーブル編集ダイアログを終了
   */
  const handleTableClose = (newMarkdown) => {
    setTableDialogOpen(false);
    if (newMarkdown === null) return;
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    const newText =
      textarea.value.substring(0, tableRange.start) +
      newMarkdown +
      textarea.value.substring(tableRange.end);
    textarea.value = newText;
    setTimeout(() => {
      setText(newText);
      saveText(mode, id, newText);
    }, 500);
  };

  /**
   * フォントの設定
   */
  const settingFont = (set, save) => {

    var style = {};
    style.fontFamily = set.name;
    style.fontSize = set.size + "px";
    style.color = set.color;
    style.backgroundColor = set.backgroundColor;
    setEditorStyle(style);

    var f = set;
    setEditorFont(f)
    if ( save ) {
      // フォント設定を保存
      SaveFont(document.documentElement.dataset.theme || 'dark', set).then(() => {
        Events.Emit('binder:editor:fontChanged', set);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });
    }
  }

  // サイドバートグルでツリーパネルの表示/非表示を切り替える
  useEventListener(Event.ShowMenu, (flag) => {
    setTreeVisible(flag);
  });

  // コミット完了（自動保存・一括コミット等）時に、開いているファイルの未記録状態を
  // 再確認してコミットボタンの強調を更新する。idRef で現在開いているIDを参照する。
  useEventListener(Event.CommitDone, () => {
    const cur = idRef.current;
    if (!cur) return;
    GetModifiedIds().then((ids) => {
      setUpdated(new Set(ids ?? []).has(cur));
    }).catch(() => {});
  });

  /**
   * 初回起動のみのエフェクト
   */
  useEffect(() => {
    // ウィンドウ再アクティブ時に IME コンテキストをリセット（Windows WebView2 対策）
    // 同一要素の blur/focus では TSF コンテキストがリセットされないため、
    // 一度 hidden input に移してから textarea に戻す（Tab で別入力を経由するのと同等）。
    const handleWindowFocus = () => {
      const m = modeRef.current;
      if (m !== Mode.note && m !== Mode.diagram && m !== Mode.template) return;
      if (composingRef.current) return;
      const textarea = document.querySelector('#editor');
      if (!textarea || !hiddenFocusRef.current) return;
      const active = document.activeElement;
      if (active && active !== textarea && active !== document.body && active !== hiddenFocusRef.current) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      hiddenFocusRef.current.focus();
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, end);
      });
    };
    const cleanupWindowFocus = Events.On('binder:window:focus', handleWindowFocus);

    //設定を取得
    GetFont(document.documentElement.dataset.theme || 'dark').then((s) => {
      if (s) settingFont(s);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    GetEditor().then((e) => {
      if (e) {
        setShowLineNumbers(e.showLineNumbers);
        setWordWrap(e.wordWrap);
        // アセット/レイヤーはプレビューを使わない（dispatch で viewer=false 済み）。
        // 復元で asset/layer に直接マウントした時、showPreview で viewer=true に
        // 上書きしてプレビューが表示されてしまうのを防ぐ。
        if (modeRef.current !== 'assets' && modeRef.current !== 'layer') {
          setViewer(e.showPreview);
        }
        if (e.autoComplete && typeof e.autoComplete === 'object') {
          setAutoComplete(e.autoComplete);
        } else {
          const v = e.autoComplete !== false;
          setAutoComplete({ template: v, idAssist: v, autoClose: v, funcHint: v, mermaid: v });
        }
        editorSettingRef.current = e;
      }
    }).catch((err) => {
      console.log(err);
    });

    return () => cleanupWindowFocus();
  }, []);

  // エディタ設定をsetting.jsonに保存するヘルパー（既存のprogram等を保持）
  const saveEditorSetting = (overrides) => {
    const editor = {
      ...editorSettingRef.current,
      showLineNumbers,
      wordWrap,
      showPreview: viewer,
      autoComplete,
      ...overrides,
    };
    editorSettingRef.current = editor;
    SaveEditor(editor).then(() => {
      Events.Emit('binder:editor:settingChanged', {
        showLineNumbers: editor.showLineNumbers,
        wordWrap: editor.wordWrap,
        showPreview: editor.showPreview,
        autoComplete: editor.autoComplete,
      });
    }).catch((err) => console.log(err));
  };


  // エディタルートではツリーパネルを常に表示する
  const showTree = true;

  return (
    <>
      <Paper id="splitScreen">

        {/** ツリーパネル */}
        {showTree && (
          <div id="editorTreePanel" className={!treeVisible ? 'hidden' : ''} style={{ width: treeWidth + 'px' }}>
            {mode === Mode.template ? <MemoTemplateTree /> : <MemoBinderTree />}
          </div>
        )}

        {/** ツリー/エディタ間スプリッター */}
        {showTree && (
          <div
            ref={treeSplitter.ref}
            id="treeSplitter"
            className={!treeVisible ? 'hidden' : ''}
            onPointerDown={treeSplitter.onPointerDown}
            onPointerMove={treeSplitter.onPointerMove}
            onPointerUp={treeSplitter.onPointerUp}
          />
        )}

        {/** エディタ + ビューアのコンテンツエリア */}
        <div id="editorContent">

          {/** アセットモード: AssetViewer がすべての表示・操作を担う */}
          {mode === 'assets' && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              <AssetViewer />
            </div>
          )}

          {/** レイヤーモード: LayerEditor がすべての表示・操作を担う */}
          {mode === 'layer' && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              <LayerEditor />
            </div>
          )}

          {/** IME リセット用 hidden input（Tab フォーカス経由と同等の TSF コンテキストリセットに使う） */}
          <input
            ref={hiddenFocusRef}
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
            readOnly
          />

          {/** エディタ */}
          {editor &&
            <div id="editorWrapper" className={!viewer ? 'viewer-hidden' : ''} style={{ width: (width - 4) + 'px' }}>

              {/** テキスト用のメニュー */}
              <EditorToolbar
                isNote={mode === Mode.note} canDownload={mode === Mode.note || mode === Mode.diagram}
                showLineNumbers={showLineNumbers}
                onToggleLineNumbers={() => { setShowLineNumbers(v => !v); saveEditorSetting({ showLineNumbers: !showLineNumbers }); }}
                wordWrap={wordWrap}
                onToggleWordWrap={() => { setWordWrap(v => !v); saveEditorSetting({ wordWrap: !wordWrap }); }}
                viewer={viewer}
                onToggleViewer={() => { setViewer(v => !v); saveEditorSetting({ showPreview: !viewer }); }}
                text={text} cursorLineRef={cursorLineRef} onJumpToLine={(line) => jumpToLine(line, true)}
                snippets={snippetList} onInsertSnippet={handleInsertSnippet}
                currentId={id} onInsertId={handleInsertId} onError={(err) => evt.showErrorMessage(err)}
                onInsert={handleInsert}
                alertsAvailable={alertsAvailable} onInsertAlert={handleInsertAlert}
                onTableEdit={handleTableEdit}
                onFontDialog={handleFontDialog} onRunEditor={handleRunEditor}
                onDownloadRaw={handleDownloadRaw} onDownloadExpanded={handleDownloadExpanded}
              />

              {/** オートコンプリートポップアップ */}
              <MemoAutocomplete
                isOpen={ac.isOpen}
                items={ac.items}
                selectedIndex={ac.selectedIndex}
                position={ac.position}
                onItemClick={ac.selectItem}
              />

              {/** テキスト検索フローティングパネル（Ctrl+F） */}
              {searchOpen && (
                <SearchBar
                  key={restoredAt}
                  text={text}
                  onClose={() => { setSearchOpen(false); setReplaceMode(false); setActiveMatchLine(null); }}
                  onNavigate={handleSearchNavigate}
                  onClearHighlight={() => setActiveMatchLine(null)}
                  initialQuery={searchQuery}
                  replaceMode={replaceMode}
                  onReplace={handleReplace}
                  onReplaceAll={handleReplaceAll}
                />
              )}

              {/** テキスト編集（行番号ガター + textarea） */}
              <EditorArea
                text={text}
                style={editorStyle}
                showLineNumbers={showLineNumbers}
                wordWrap={wordWrap}
                activeLine={activeMatchLine}
                errorLine={parseStatus.status === "error" && parseStatus.errorLine ? parseStatus.errorLine : null}
                onErrorLineDoubleClick={parseStatus.err ? () => setParseErrorDlg(true) : undefined}
                onKeyDown={handleKeyDown}
                onChange={handleChangeText}
                onSelect={handleSelectionChange}
                onPaste={handlePaste}
                onCursorMove={handleCursorMove}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                dropTarget={mode === Mode.note ? {
                  'data-file-drop-target': '',
                  'data-wails-node-id': id,
                  'data-wails-node-type': 'note',
                  'data-wails-drop-kind': 'editor',
                } : undefined}
              />

              {/** ID ステータスバー */}
              <MemoIdStatusBar
                structures={cursorStructures}
                currentIndex={cursorStructureIndex}
                onIndexChange={setCursorStructureIndex}
                onNavigate={handleIdNavigate}
                funcHint={funcHint}
              />

              {/** コミットバー */}
              <MemoCommitBar
                comment={comment}
                onCommentChange={setComment}
                updated={updated}
                onCommit={handleCommit}
              />
            </div>
          }

          {/** セパレータ（エディタ/ビューア間） */}
          {editor &&
            <div ref={splitter.ref} id="splitter"
              className={!viewer ? 'hidden' : ''}
              onPointerDown={splitter.onPointerDown}
              onPointerMove={splitter.onPointerMove}
              onPointerUp={splitter.onPointerUp}
            />
          }

          {/** 表示側 */}
            <div id="dataViewer" className={!viewer ? 'hidden' : ''}>

              {/** プレビューメニュー（前回の選択はモジュールの変数に覚えておき、開き直したときに戻す） */}
              <PreviewToolbar
                isNote={mode === Mode.note} isTemplate={mode === Mode.template} templateType={templateType}
                previewDiagrams={previewDiagrams} previewDiagramId={previewDiagramId}
                onPreviewDiagramChange={(v) => { lastPreviewDiagramId = v; setPreviewDiagramId(v); }}
                previewOtherTemplates={templateType === "layout" ? previewContents : previewLayouts}
                previewOtherTemplateId={previewOtherTemplateId}
                onPreviewOtherTemplateChange={(v) => { lastPreviewOtherTemplateId = v; setPreviewOtherTemplateId(v); }}
                previewNotes={previewNotes} previewNoteId={previewNoteId}
                onPreviewNoteChange={(v) => { lastPreviewNoteId = v; setPreviewNoteId(v); }}
                scriptsBlocked={scriptsBlocked} onScriptsBlockedClick={() => evt.openBinderModal()}
                colorSchemeConfig={colorSchemeConfig} colorSchemeIndex={colorSchemeIndex}
                onNextColorScheme={() => setColorSchemeIndex((prev) => (prev + 1) % colorSchemeConfig.values.length)}
                onDownload={handleDownload} onDownloadZip={handleDownloadZip}
                onOpenPreviewWindow={() => OpenPreviewWindow(mode, id, name)}
                onPublish={handlePublish} publishDisabled={parseStatus.status === "error" || isPrivate}
                onOpenInBrowser={handleOpenInBrowser} openInBrowserDisabled={!alias || mode === Mode.template}
                onUnpublish={handleUnpublish}
              />

              {/** プレビューコンテンツ */}
              <div id="previewContent">
                {(mode === Mode.note) &&
                  <HTMLFrame html={html} cursorLine={cursorLine} colorSchemeAttr={colorSchemeConfig?.attribute} colorSchemeValue={colorSchemeConfig?.values[colorSchemeIndex]} customScrollbar={previewScrollbar} allowScripts={allowScripts} onScriptsBlocked={setScriptsBlocked} onLinkExternal={handleLinkExternal} onLinkInternal={handleLinkInternal} onContextMenu={handlePreviewContextMenu} onHeadingClick={editor ? handlePreviewHeadingClick : undefined} onBlockDoubleClick={editor ? handlePreviewBlockDoubleClick : undefined} unresolvedLabel={t("preview.unresolvedResource")} unresolvedHints={{ diagram: t("preview.unresolvedHint.diagram"), layer: t("preview.unresolvedHint.layer"), asset: t("preview.unresolvedHint.asset") }} />
                }
                {mode === Mode.diagram &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType === "diagram" &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType !== "diagram" &&
                  <HTMLFrame html={html} cursorLine={cursorLine} colorSchemeAttr={colorSchemeConfig?.attribute} colorSchemeValue={colorSchemeConfig?.values[colorSchemeIndex]} customScrollbar={previewScrollbar} allowScripts={allowScripts} onScriptsBlocked={setScriptsBlocked} onLinkExternal={handleLinkExternal} onLinkInternal={handleLinkInternal} onContextMenu={handlePreviewContextMenu} unresolvedLabel={t("preview.unresolvedResource")} unresolvedHints={{ diagram: t("preview.unresolvedHint.diagram"), layer: t("preview.unresolvedHint.layer"), asset: t("preview.unresolvedHint.asset") }} />
                }
              </div>

              <PreviewContextMenu
                state={previewMenu}
                onClose={closePreviewMenu}
                onBack={handleHistoryBack}
                onForward={handleHistoryForward}
                onCopy={copyClipboard}
                onCopyLink={copyClipboard}
                onOpenExternal={handleLinkExternal}
                onOpenInternal={handleLinkInternal}
              />

              {/** パースステータスバー */}
              <ParseStatusBar parseStatus={parseStatus}
                selectionChars={selectionChars} totalChars={totalChars} saveState={saveState}
                onShowError={() => setParseErrorDlg(true)} onShowWarnings={() => setParseWarningDlg(true)} />

            </div>

        </div>

      </Paper>

      {/** フォント設定 */}
      <FontDialog show={fontDialog} font={editorFont} onClose={handleFontDialogClose} />

      {/** テーブル編集ダイアログ */}
      <TableDialog
        open={tableDialogOpen}
        tableLines={tableDialogLines}
        onClose={handleTableClose}
      />

      {/** パースエラー・警告の詳細ダイアログ */}
      <ParseDialogs parseStatus={parseStatus}
        errorOpen={parseErrorDlg} warningOpen={parseWarningDlg}
        onCloseError={() => setParseErrorDlg(false)} onCloseWarning={() => setParseWarningDlg(false)} />

      {/** 未公開確認ダイアログ */}
      {publishRefsDialog}
      <Dialog open={unpublishConfirm} onClose={() => setUnpublishConfirm(false)}>
        <DialogTitle>{t("preview.unpublishConfirm")}</DialogTitle>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishConfirm(false)} />
          <ActionButton variant="delete" label={t("preview.unpublish")} icon={<UnpublishedIcon />} onClick={doUnpublish} />
        </DialogActions>
      </Dialog>

      {/** 外部エディタ実行中ロック */}
      <Backdrop open={editorLocked} sx={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', color: '#fff', fontSize: '14px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '40px', borderRadius: '10px' }}>
          <span>{t("editor.externalEditorLocked")}</span>
          {editorDetached && (
            <Button variant="contained" onClick={handleFinishExternalEditor}>{t("editor.finishExternalEditor")}</Button>
          )}
        </div>
      </Backdrop>
    </>
  );
}

export default Editor;
export { editorHistory, editorHistoryURL };
