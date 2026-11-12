import { useState, useEffect, useContext, useRef, useCallback, useMemo, memo } from "react"
import { useParams, useLocation, useNavigate } from "react-router";

import { Backdrop, Button, Paper } from "@mui/material";

import { OpenNote, OpenDiagram, OpenTemplate } from "../../../bindings/binder/api/app";
import { Commit, GetConfig } from "../../../bindings/binder/api/app";
import { GetModifiedIds } from "../../../bindings/binder/api/app";
import { GetFont, SaveFont, GetSnippets, GetEditor, SaveEditor, GetStructure, GetPreviewScrollbar, IsBinderTrusted } from "../../../bindings/binder/api/app";
import { RunEditor, OpenPreviewWindow } from "../../../bindings/main/window";
import { Events, Browser } from '@wailsio/runtime';

import Mermaid from "./engines/Mermaid.jsx";
import EditorArea from "./EditorArea.jsx";
import SearchBar from "./SearchBar.jsx";
import Autocomplete from "./Autocomplete.jsx";
import { handleMarkdownEnter, handleMarkdownFormat, handleMarkdownTab, scrollCaretIntoView, linkFromPaste } from "@shared/editor/markdown-keys";
import { countChars } from "@shared/editor/char-count";
import { idInsertText, isInsideTemplate } from "./id-insert";
import { extractHeadings, findHeadingLine } from "@shared/editor/outline";
import { alertInsertText } from "@shared/editor/alerts";
import { useAutocomplete } from "@shared/editor/useAutocomplete";
import { goTemplateCandidates } from "@shared/editor/go-template-candidates";
import { extractUuidsOnLine } from "@shared/editor/id-detect";
import { detectTemplateFunc } from "@shared/editor/template-detect";
import IdStatusBar from "./IdStatusBar.jsx";

import Event, { EventContext, useEventListener } from "../../Event.jsx";
import "../../language";
import { useTranslation } from 'react-i18next';

import HTMLFrame from "./HTMLFrame.jsx";
import PreviewContextMenu from "@shared/editor/PreviewContextMenu";
import { resolveBinderLink } from "./binder-link";
import { watchExternalEditor } from "./external-editor";
import { editorHistory, editorHistoryURL, emitHistoryState } from "./editor-history";
import { tsvToMarkdownTable, detectTableAt } from "./table-markdown";
import { writeFn } from "./editor-save";
import { useEditorCandidates } from "./useEditorCandidates";
import { useEditorDownloads } from "./useEditorDownloads";
import { useEditorDocument } from "./useEditorDocument";
import { useEditorPublish } from "./useEditorPublish.jsx";
import { useSplitterDrag } from "./useSplitterDrag";
import { useStableHandlers } from "./useStableHandlers";
import EditorToolbar from "./EditorToolbar.jsx";
import PreviewToolbar from "./PreviewToolbar.jsx";
import ParseStatusBar, { ParseDialogs } from "./ParseStatusBar.jsx";
import '../../assets/Editor.css'
import { Mode } from "../../mode";
import { copyClipboard } from "../../app/App.jsx";

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
// ツールバーとダイアログも同じく遮断する。本体から渡すハンドラは useStableHandlers で
// 描画をまたいで同じ関数にしてあるので、表示に関わる値が変わったときだけ描き直される
const MemoEditorToolbar = memo(EditorToolbar);
const MemoPreviewToolbar = memo(PreviewToolbar);
const MemoParseDialogs = memo(ParseDialogs);
const MemoPreviewContextMenu = memo(PreviewContextMenu);
const MemoFontDialog = memo(FontDialog);
const MemoTableDialog = memo(TableDialog);

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
  const saveText = useCallback((m, i, txt) => {
    const seq = ++saveSeqRef.current;
    setSaveState("saving");
    const p = writeFn(m, i, txt);
    p.then(
      () => { if (saveSeqRef.current === seq) setSaveState("saved"); },
      () => { if (saveSeqRef.current === seq) setSaveState("error"); },
    );
    return p;
  }, []);

  // 開くものが変わったら、保存の状態と選択の文字数を戻す
  useEffect(() => {
    saveSeqRef.current++;
    setSaveState(null);
    setSelectionChars(0);
  }, [mode, id]);

  // カーソル行の UUID に対応する Structure 情報（複数対応）
  const [cursorStructures, setCursorStructures] = useState([]);
  const [cursorStructureIndex, setCursorStructureIndex] = useState(0);
  const idDetectTimerRef = useRef(null);
  const lastDetectedUuidsRef = useRef(null);
  // テンプレート関数ヒント
  const [funcHint, setFuncHint] = useState(null);

  // IME リセット用の hidden input への ref（ウィンドウ再アクティブ時に中継フォーカスとして使う）
  const hiddenFocusRef = useRef(null);

  // useEffect([]) 内など古いクロージャから最新の mode/id/name を参照するための ref
  const modeRef = useRef(mode);
  const idRef = useRef(id);
  const nameRef = useRef("");
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

  // カーソル行（1始まり）- handleChangeText で更新し、プレビューを作るときに HTMLFrame へ渡す
  const cursorLineRef = useRef(1);
  const composingRef = useRef(false);
  const [cursorLine, setCursorLine] = useState(1);

  // エディタ設定（setting.json の editor）。開くときにプレビューの表示を戻すのにも使う
  const editorSettingRef = useRef(null);

  // 開いているもの: 本文・名前などの読み込みと、プレビューの生成。
  // 開く（useEffect([id, restoredAt])）・いつプレビューを作るか（useEffect([text, openSeq])）もこの中。
  // 上の modeRef / idRef を合わせる useEffect より後ろに置く（読み込みが idRef を見るため）
  const {
    text, setText, editText, loadingRef,
    name, updated, setUpdated, isPrivate, alias, styleTemplateId, templateType,
    html, htmlRef, parseStatus, createMarked, targets,
  } = useEditorDocument({
    mode, id, restoredAt, idRef, cursorLineRef, setCursorLine, setAlertsAvailable,
    setEditor, setViewer, editorSettingRef, evt, t,
  });
  const { noteId: previewNoteId, otherTemplateId: previewOtherTemplateId, diagramId: previewDiagramId } = targets;
  useEffect(() => { nameRef.current = name; }, [name]);

  // ページ全体の文字数
  const totalChars = useMemo(() => countChars(text), [text]);

  // プレビューのスクロールバーをエディタ画面と揃えるか（アプリ設定・デフォルトON）
  const [previewScrollbar, setPreviewScrollbar] = useState(true);
  const [allowScripts, setAllowScripts] = useState(false);
  // 表示中のプレビューでスクリプトを止めたか（止めたときだけアイコンを出す）
  const [scriptsBlocked, setScriptsBlocked] = useState(false);

  /**
   * エディタの選んでいる範囲（range を渡せばその範囲）を str で置き換える。
   * ツールバー・メニュー・検索の置換・オートコンプリートなど、打鍵以外で本文へ入れるときはこれを通す。
   *
   * execCommand で入れるので、元に戻す（Ctrl+Z）の対象になる。execCommand は同期で textarea.value を
   * 確定するため、次のフレームで state と保存へ反映すれば足りる（入力中のデバウンスは通らず、プレビューはすぐ作り直す）。
   *
   * @param {string} str 入れる文字列
   * @param {{ start: number, end: number }} [range] 置き換える範囲。省けばいまの選択範囲
   * @returns {HTMLTextAreaElement|null} 入れたら textarea、入れなかったら null
   */
  const insertIntoEditor = useCallback((str, range) => {
    // 開いている途中（前の本文を出したまま読んでいる間）は入れない。
    // 入れると、前の本文に入れた内容が新しく開く側の ID で保存されてしまう（handleChangeText と同じ）
    if (loadingRef.current) return null;
    const textarea = document.querySelector("#editor");
    if (!textarea) return null;
    // 保存先は入れた時点のもの（次のフレームまでに別のものを開いても、そちらへは保存しない）
    const m = modeRef.current;
    const i = idRef.current;
    textarea.focus();
    if (range) textarea.setSelectionRange(range.start, range.end);
    document.execCommand('insertText', false, str);
    requestAnimationFrame(() => {
      setText(textarea.value);
      saveText(m, i, textarea.value);
    });
    return textarea;
  }, [saveText]);

  // オートコンプリートの挿入処理
  const handleAutocompleteSelect = useCallback((trigger, selected, replaceStart, replaceEnd) => {
    const textarea = document.querySelector("#editor");
    if (!textarea) return;
    // replaceStart がトリガー文字列の位置かどうかで挿入テキストを分岐
    const atTrigger = textarea.value.substring(replaceStart, replaceStart + trigger.length) === trigger;
    let insertText;
    let cursorOffset = 0;
    let end = replaceEnd;
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
      if (afterEnd === '"') end = replaceEnd + 1;
    } else if (trigger === '{{' && atTrigger) {
      // ブロックキーワード選択時: 閉じタグを自動挿入
      const candidate = goTemplateCandidates.find(c => c.label === selected);
      if (candidate?.needsEnd && autoComplete.autoClose) {
        const closing = ' }} {{end}}';
        insertText += closing;
        cursorOffset = -closing.length;
      }
    }
    if (!insertIntoEditor(insertText, { start: replaceStart, end })) return;
    if (cursorOffset) {
      const pos = textarea.selectionStart + cursorOffset;
      textarea.setSelectionRange(pos, pos);
    }
  }, [insertIntoEditor, autoComplete.autoClose]);

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

  const [parseErrorDlg, setParseErrorDlg] = useState(false);
  const [parseWarningDlg, setParseWarningDlg] = useState(false);

  // プレビューカラースキーム
  const [colorSchemeConfig, setColorSchemeConfig] = useState(null);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);

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
    insertIntoEditor(replacement, { start: absoluteStart, end: absoluteEnd });
  }, [insertIntoEditor]);

  const handleReplaceAll = useCallback((matches, replacement) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      newText = newText.substring(0, m.absoluteStart) + replacement + newText.substring(m.absoluteEnd);
    }
    // 全体を選んで置き換える（1 回の「元に戻す」で戻せる）
    insertIntoEditor(newText, { start: 0, end: textarea.value.length });
  }, [text, insertIntoEditor]);

  useEffect(() => {
    GetConfig().then((conf) => {
      if (conf.previewColorScheme) {
        setColorSchemeConfig(conf.previewColorScheme);
      }
    }).catch(() => {});
  }, []);

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

  // モードに対応するスニペット一覧（memo にしたツールバーへ渡すので、中身が同じなら同じ配列にする）
  const snippetList = useMemo(() => {
    if (mode === Mode.note) return [...(snippets.markdowns ?? []), ...(snippets.templates ?? [])];
    if (mode === Mode.diagram) return snippets.diagrams ?? [];
    if (mode === Mode.template) return snippets.templates ?? [];
    return [];
  }, [mode, snippets]);

  /**
   * スニペットをカーソル位置に挿入
   * ボタン・MenuItem の onMouseDown で preventDefault することでフォーカスを
   * textarea に保持したまま selectionStart/End を直接読み取る。
   */
  const handleInsertSnippet = (body) => {
    insertIntoEditor(body);
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
    insertIntoEditor(text);
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

    var txt = e.target.value;
    // カーソル行を記録（デバウンス後にプレビューを作るときに使う）
    const pos = e.target.selectionStart;
    cursorLineRef.current = txt.substring(0, pos).split('\n').length;
    // 入力中として差し替える（プレビューはデバウンスして作る）
    editText(txt);
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

  // 公開・非公開・ブラウザで開く
  const pub = useEditorPublish({ mode, id, name, text, alias, styleTemplateId, createMarked, evt, t });

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

  // ダウンロード（プレビュー・本文そのまま・展開済み・zip）
  const downloads = useEditorDownloads({ mode, id, name, text, html, onError: (err) => evt.showErrorMessage(err) });

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
        editText(textarea.value);
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

    editText(textarea.value);
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

    insertIntoEditor(insertText);
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
          editText(result.value);
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
        editText(result.value);
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
      editText(result.value);
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

  // プレビュー（HTMLFrame）へ渡すもの。ノートとテンプレートで同じ
  const frameProps = {
    html, cursorLine,
    colorSchemeAttr: colorSchemeConfig?.attribute,
    colorSchemeValue: colorSchemeConfig?.values[colorSchemeIndex],
    customScrollbar: previewScrollbar,
    allowScripts,
    onScriptsBlocked: setScriptsBlocked,
    onLinkExternal: handleLinkExternal,
    onLinkInternal: handleLinkInternal,
    onContextMenu: handlePreviewContextMenu,
    unresolvedLabel: t("preview.unresolvedResource"),
    unresolvedHints: { diagram: t("preview.unresolvedHint.diagram"), layer: t("preview.unresolvedHint.layer"), asset: t("preview.unresolvedHint.asset") },
  };

  // memo にした部品（ツールバー・ダイアログ）へ渡すハンドラ。
  // 打鍵のたびに作り直される関数をそのまま渡すと memo が効かないので、同じ関数のまま渡す
  const h = useStableHandlers({
    // エディタ側のツールバー
    toggleLineNumbers: () => { setShowLineNumbers(v => !v); saveEditorSetting({ showLineNumbers: !showLineNumbers }); },
    toggleWordWrap: () => { setWordWrap(v => !v); saveEditorSetting({ wordWrap: !wordWrap }); },
    toggleViewer: () => { setViewer(v => !v); saveEditorSetting({ showPreview: !viewer }); },
    jumpToLine: (line) => jumpToLine(line, true),
    insertSnippet: handleInsertSnippet,
    insertId: handleInsertId,
    error: (err) => evt.showErrorMessage(err),
    insert: handleInsert,
    insertAlert: handleInsertAlert,
    tableEdit: handleTableEdit,
    fontDialog: handleFontDialog,
    runEditor: handleRunEditor,
    downloadRaw: downloads.downloadRaw,
    downloadExpanded: downloads.downloadExpanded,
    // プレビュー側のツールバー（選んだものは useTemplatePreviewTargets が覚えておき、開き直したときに戻す）
    previewDiagramChange: targets.changeDiagram,
    previewOtherTemplateChange: targets.changeOtherTemplate,
    previewNoteChange: targets.changeNote,
    scriptsBlockedClick: () => evt.openBinderModal(),
    nextColorScheme: () => setColorSchemeIndex((prev) => (prev + 1) % colorSchemeConfig.values.length),
    download: downloads.download,
    downloadZip: downloads.downloadZip,
    openPreviewWindow: () => OpenPreviewWindow(mode, id, name),
    publish: pub.publish,
    openInBrowser: pub.openInBrowser,
    unpublish: pub.unpublish,
    // プレビューのコンテキストメニュー
    closePreviewMenu,
    historyBack: handleHistoryBack,
    historyForward: handleHistoryForward,
    linkExternal: handleLinkExternal,
    linkInternal: handleLinkInternal,
    // ダイアログ
    fontDialogClose: handleFontDialogClose,
    tableClose: handleTableClose,
    closeParseError: () => setParseErrorDlg(false),
    closeParseWarning: () => setParseWarningDlg(false),
  });

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
              {/** 本文（text）は渡さない。渡すと打鍵のたびに描き直される。アウトラインは開いたときに textarea から読む */}
              <MemoEditorToolbar
                isNote={mode === Mode.note} canDownload={mode === Mode.note || mode === Mode.diagram}
                showLineNumbers={showLineNumbers}
                onToggleLineNumbers={h.toggleLineNumbers}
                wordWrap={wordWrap}
                onToggleWordWrap={h.toggleWordWrap}
                viewer={viewer}
                onToggleViewer={h.toggleViewer}
                cursorLineRef={cursorLineRef} onJumpToLine={h.jumpToLine}
                snippets={snippetList} onInsertSnippet={h.insertSnippet}
                currentId={id} onInsertId={h.insertId} onError={h.error}
                onInsert={h.insert}
                alertsAvailable={alertsAvailable} onInsertAlert={h.insertAlert}
                onTableEdit={h.tableEdit}
                onFontDialog={h.fontDialog} onRunEditor={h.runEditor}
                onDownloadRaw={h.downloadRaw} onDownloadExpanded={h.downloadExpanded}
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

              {/** プレビューメニュー */}
              <MemoPreviewToolbar
                isNote={mode === Mode.note} isTemplate={mode === Mode.template} templateType={templateType}
                previewDiagrams={targets.diagrams} previewDiagramId={previewDiagramId}
                onPreviewDiagramChange={h.previewDiagramChange}
                previewOtherTemplates={targets.otherTemplates(templateType)}
                previewOtherTemplateId={previewOtherTemplateId}
                onPreviewOtherTemplateChange={h.previewOtherTemplateChange}
                previewNotes={targets.notes} previewNoteId={previewNoteId}
                onPreviewNoteChange={h.previewNoteChange}
                scriptsBlocked={scriptsBlocked} onScriptsBlockedClick={h.scriptsBlockedClick}
                colorSchemeConfig={colorSchemeConfig} colorSchemeIndex={colorSchemeIndex}
                onNextColorScheme={h.nextColorScheme}
                onDownload={h.download} onDownloadZip={h.downloadZip}
                onOpenPreviewWindow={h.openPreviewWindow}
                onPublish={h.publish} publishDisabled={parseStatus.status === "error" || isPrivate}
                onOpenInBrowser={h.openInBrowser} openInBrowserDisabled={!alias || mode === Mode.template}
                onUnpublish={h.unpublish}
              />

              {/** プレビューコンテンツ */}
              <div id="previewContent">
                {(mode === Mode.note) &&
                  <HTMLFrame {...frameProps}
                    onHeadingClick={editor ? handlePreviewHeadingClick : undefined}
                    onBlockDoubleClick={editor ? handlePreviewBlockDoubleClick : undefined} />
                }
                {mode === Mode.diagram &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType === "diagram" &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType !== "diagram" &&
                  <HTMLFrame {...frameProps} />
                }
              </div>

              <MemoPreviewContextMenu
                state={previewMenu}
                onClose={h.closePreviewMenu}
                onBack={h.historyBack}
                onForward={h.historyForward}
                onCopy={copyClipboard}
                onCopyLink={copyClipboard}
                onOpenExternal={h.linkExternal}
                onOpenInternal={h.linkInternal}
              />

              {/** パースステータスバー */}
              <ParseStatusBar parseStatus={parseStatus}
                selectionChars={selectionChars} totalChars={totalChars} saveState={saveState}
                onShowError={() => setParseErrorDlg(true)} onShowWarnings={() => setParseWarningDlg(true)} />

            </div>

        </div>

      </Paper>

      {/** フォント設定 */}
      <MemoFontDialog show={fontDialog} font={editorFont} onClose={h.fontDialogClose} />

      {/** テーブル編集ダイアログ */}
      <MemoTableDialog
        open={tableDialogOpen}
        tableLines={tableDialogLines}
        onClose={h.tableClose}
      />

      {/** パースエラー・警告の詳細ダイアログ */}
      <MemoParseDialogs parseStatus={parseStatus}
        errorOpen={parseErrorDlg} warningOpen={parseWarningDlg}
        onCloseError={h.closeParseError} onCloseWarning={h.closeParseWarning} />

      {/** 公開まわりのダイアログ（一緒に公開する参照先の選択・非公開の確認） */}
      {pub.dialogs}

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
