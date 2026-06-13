import { useState, useEffect, useContext, useRef, useCallback } from "react"
import { useParams, useLocation } from "react-router";

import { Backdrop, Button, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Menu, MenuItem, Paper, TextField, Toolbar, Select, ToggleButton, Tooltip, Divider } from "@mui/material";

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../../bindings/binder/api/app";
import { GetDiagram, OpenDiagram, SaveDiagram, ParseDiagram } from "../../../bindings/binder/api/app";
import { GetTemplate, OpenTemplate, SaveTemplate } from "../../../bindings/binder/api/app";
import { GetHTMLTemplates, GetBinderTree, CreateTemplateHTML } from "../../../bindings/binder/api/app";
import { GetAsset, Generate, Unpublish, Commit, DropAsset, Address, CollectExportDeps, GetConfig } from "../../../bindings/binder/api/app";
import { GetLayer } from "../../../bindings/binder/api/app";
import { GetFont, SaveFont, GetSnippets, GetEditor, SaveEditor } from "../../../bindings/binder/api/app";
import { RunEditor, OpenPreviewWindow, DownloadNote } from "../../../bindings/main/window";
import { Events, Browser } from '@wailsio/runtime';

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";
import EditorArea from "./EditorArea.jsx";
import SearchBar from "./SearchBar.jsx";
import { handleMarkdownEnter } from "@shared/editor/markdown-keys";

import Event, { EventContext } from "../../Event.jsx";
import { ActionButton } from "../../dialogs/components/ActionButton";
import "../../language";
import { useTranslation } from 'react-i18next';

import HTMLFrame from "./HTMLFrame.jsx";
import '../../assets/Editor.css'
import { Mode } from "../../app/App.jsx";

import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import LaunchIcon from '@mui/icons-material/Launch';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import PreviewIcon from '@mui/icons-material/Preview';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import NewLabelIcon from '@mui/icons-material/NewLabel';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import WrapTextIcon from '@mui/icons-material/WrapText';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import TableChartIcon from '@mui/icons-material/TableChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ContrastIcon from '@mui/icons-material/Contrast';
import FontDialog from "../../dialogs/FontDialog.jsx";
import TableDialog from "../../dialogs/TableDialog.jsx";

import BinderTree from "../../components/BinderTree.jsx";
import TemplateTree from "../../app/TemplateTree.jsx";
import AssetViewer from "../../components/AssetViewer.jsx";
import LayerEditor from "../../components/LayerEditor.jsx";
import CommitBar from "../../components/CommitBar.jsx";

/**
 * ツリーからノートのみを再帰的に抽出する
 */
function flattenNotes(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.type === "note") {
      result.push({ id: node.id, name: node.name });
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenNotes(node.children));
    }
  }
  return result;
}

/**
 * ツリーからダイアグラムのみを再帰的に抽出する
 */
function flattenDiagrams(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.type === "diagram") {
      result.push({ id: node.id, name: node.name });
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenDiagrams(node.children));
    }
  }
  return result;
}

/**
 * ツリーから全Structureをフラットに抽出する
 */
function flattenStructures(nodes) {
  const result = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, type: node.type, parentId: node.parentId });
    if (node.children && node.children.length > 0) {
      result.push(...flattenStructures(node.children));
    }
  }
  return result;
}

/**
 * タブ区切りテキストをMarkdownテーブルに変換する
 * Excel等からの貼り付けデータを想定。
 * 判定条件: 2行以上、各行にタブが1つ以上、全行のタブ数（列数）が一致
 * @param {string} text
 * @returns {string|null} Markdownテーブル文字列。タブ区切りでなければ null
 */
function tsvToMarkdownTable(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
  if (lines.length < 2) return null;

  const tabCounts = lines.map(line => (line.match(/\t/g) || []).length);
  if (tabCounts[0] === 0) return null;
  if (!tabCounts.every(c => c === tabCounts[0])) return null;

  const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
  const colCount = rows[0].length;

  const header = '| ' + rows[0].join(' | ') + ' |';
  const separator = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
  const body = rows.slice(1).map(row => {
    while (row.length < colCount) row.push('');
    return '| ' + row.join(' | ') + ' |';
  });

  return [header, separator, ...body].join('\n');
}

/**
 * カーソル位置からマークダウンテーブルの範囲を検出する
 * @param {string} fullText
 * @param {number} cursorPos
 * @returns {{ startOffset: number, endOffset: number, lines: string[] } | null}
 */
function detectTableAt(fullText, cursorPos) {
  const allLines = fullText.split("\n");
  let offset = 0;
  let cursorLineIdx = -1;

  for (let i = 0; i < allLines.length; i++) {
    const lineEnd = offset + allLines[i].length;
    if (cursorPos <= lineEnd) {
      cursorLineIdx = i;
      break;
    }
    offset = lineEnd + 1;
  }

  if (cursorLineIdx < 0) return null;
  if (!allLines[cursorLineIdx].trimStart().startsWith("|")) return null;

  let startLine = cursorLineIdx;
  while (startLine > 0 && allLines[startLine - 1].trimStart().startsWith("|")) {
    startLine--;
  }

  let endLine = cursorLineIdx;
  while (endLine < allLines.length - 1 && allLines[endLine + 1].trimStart().startsWith("|")) {
    endLine++;
  }

  const tableLines = allLines.slice(startLine, endLine + 1);
  if (tableLines.length < 2) return null;
  if (!/^\|[-:| ]+\|$/.test(tableLines[1].trim())) return null;

  const startOffset =
    allLines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0);
  const endOffset = startOffset + tableLines.join("\n").length;

  return { startOffset, endOffset, lines: tableLines };
}

/**
 * テンプレートプレビューHTMLを生成する
 */
async function runTemplatePreview(templateId, templateType, otherTemplateId, noteId) {
  const content = await OpenNote(noteId);
  const parseResult = await ParseNote(noteId, true, content);
  if (parseResult.error) return parseResult;
  const marked = await Marked.parse(parseResult.html);
  const templateResult = await CreateTemplateHTML(templateId, templateType, otherTemplateId, noteId, marked);
  templateResult.warnings = [...(parseResult.warnings || []), ...(templateResult.warnings || [])];
  return templateResult;
}

//指定秒数での実行処理
const debouncePromiss = (fn, delay) => {
  var timer = null;
  return function (...args) {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(fn.apply(this, args));
      }, delay);
    });
  }
}

// テンプレートプレビューで前回選択したノート・テンプレート・ダイアグラムを記憶する
let lastPreviewNoteId = "";
let lastPreviewOtherTemplateId = "";
let lastPreviewDiagramId = "";

//テキストの保存処理（デバウンス）
const writeFn = debouncePromiss((mode, id, txt) => {
  if (mode === Mode.note) {
    return SaveNote(id, txt);
  } else if (mode === Mode.diagram) {
    return SaveDiagram(id, txt);
  } else if (mode === Mode.template) {
    return SaveTemplate(id, txt);
  }
}, 1000);

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
  const restoredAt = location.state?.restoredAt;
  const searchQuery = location.state?.searchQuery;
  const evt = useContext(EventContext)
  const {t} = useTranslation();

  const [editor, setEditor] = useState(true);
  const [viewer, setViewer] = useState(true);
  const [editorLocked, setEditorLocked] = useState(false);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  // 行番号表示トグル
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  // テキスト折り返しトグル
  const [wordWrap, setWordWrap] = useState(true);
  // テキスト検索バーの表示状態
  const [searchOpen, setSearchOpen] = useState(false);
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

  // エディタメニュー MoreVert
  const [editorMoreMenu, setEditorMoreMenu] = useState({ open: false, el: null });
  const openEditorMoreMenu = (el) => setEditorMoreMenu({ open: true, el });
  const closeEditorMoreMenu = () => { setEditorMoreMenu({ open: false, el: null }); setTextDownloadMenuAnchor(null); };

  // テキストダウンロードサブメニューのアンカー要素
  const [textDownloadMenuAnchor, setTextDownloadMenuAnchor] = useState(null);

  // プレビューメニュー MoreVert
  const [previewMoreMenu, setPreviewMoreMenu] = useState({ open: false, el: null });
  const openPreviewMoreMenu = (el) => setPreviewMoreMenu({ open: true, el });
  const closePreviewMoreMenu = () => setPreviewMoreMenu({ open: false, el: null });

  // スニペット
  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });
  const [snippetAnchor, setSnippetAnchor] = useState(null);

  // ID挿入
  const [idListAnchor, setIdListAnchor] = useState(null);
  const [idList, setIdList] = useState([]);

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
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { nameRef.current = name; }, [name]);

  // ユーザーがテキストを入力中かどうかのフラグ / デバウンスタイマー
  // handleChangeText だけが true にセットする。ファイルオープン時はセットされないので即時描画になる。
  const isEditingRef = useRef(false);
  const parseTimerRef = useRef(null);

  // カーソル行（1始まり）- handleChangeText で更新し parseText で HTMLFrame に渡す
  const cursorLineRef = useRef(1);
  const composingRef = useRef(false);
  const [cursorLine, setCursorLine] = useState(1);

  const [editorFont, setEditorFont] = useState(undefined);
  const [editorStyle, setEditorStyle] = useState({});
  const editorSettingRef = useRef(null);

  // パースステータス（プレビュー下部のステータスバー用）
  const [parseStatus, setParseStatus] = useState({ status: "success", err: null, warnings: [] });
  const [parseErrorDlg, setParseErrorDlg] = useState(false);
  const [parseWarningDlg, setParseWarningDlg] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [alias, setAlias] = useState('');
  const [serverAddress, setServerAddress] = useState('');
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

  // Ctrl+F で検索バーを開く
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  useEffect(() => {
    Address().then((addr) => setServerAddress(addr)).catch(() => {});
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
      setText("");

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
          const content = await OpenTemplate(resp.styleTemplate).catch(() => "");
          Mermaid.setStyleTemplate(resp.styleTemplate, content);
        }
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      Promise.all([OpenDiagram(id), metaReady]).then(([diagramText]) => {
        fileOpeningRef.current = true;
        setText(diagramText);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.note) {

      setEditor(true);
      // assets/layer モードから戻った場合に viewer 状態を復元する
      if (editorSettingRef.current) {
        setViewer(editorSettingRef.current.showPreview);
      }
      OpenNote(id).then((resp) => {
        fileOpeningRef.current = true;
        setText(resp);
      }).catch((err) => {
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
      setText("");                   // 非同期ロード前にリセット（初回描画ガード用）
      setTemplateType("");          // 前テンプレートの型が残ると stale preview が発生するためリセット
      setPreviewOtherTemplateId(""); // 同上
      diagramInitializedRef.current = null; // 同一IDへの再訪問に備えてリセット

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
        fileOpeningRef.current = true;
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

    // note/diagram/template ではエディタ textarea にフォーカスを移す
    // カーソル位置を保持してからfocusすることで、focusによるスクロールジャンプを防ぐ
    if (mode === Mode.note || mode === Mode.diagram || mode === Mode.template) {
      setTimeout(() => {
        const textarea = document.querySelector('#editor');
        if (textarea) {
          const s = textarea.selectionStart;
          const e = textarea.selectionEnd;
          textarea.focus();
          textarea.setSelectionRange(s, e);
        }
      }, 200);
    }

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
    setSnippetAnchor(null);
    // execCommand は同期で textarea.value を確定するため、次フレームで state へ反映すれば足りる
    requestAnimationFrame(() => {
      setText(textarea.value);
      writeFn(mode, id, textarea.value);
    });
  };

  // エディタへのテキスト挿入イベントを購読
  // BinderTree などから {{assetImage "id"}} などのテキストをカーソル位置に挿入する
  useEffect(() => {
    evt.register('Editor', Event.InsertText, (text) => {
      const textarea = document.querySelector("#editor");
      if (!textarea) return;

      textarea.focus();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setSelectionRange(start, end);
      document.execCommand('insertText', false, text);

      requestAnimationFrame(() => {
        setText(textarea.value);
        writeFn(modeRef.current, idRef.current, textarea.value);
      });
    });
  }, []);

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
      return;
    }

    if (mode === Mode.diagram) {
      viewDiagram(text);
    } else if (mode === Mode.note) {
      // カーソル行を確定してから描画
      setCursorLine(cursorLineRef.current);
      viewHTML(text);
    } else if (mode === Mode.template) {
      if (templateType === "diagram") {
        // ダイアグラムテンプレート: 選択中のダイアグラムにテンプレートを適用して描画
        if (!previewDiagramId) return;
        viewDiagramTemplatePreview(text, previewDiagramId);
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
      parseTimerRef.current = setTimeout(parseText, 500);
      return () => clearTimeout(parseTimerRef.current);
    }
    // ファイルオープン時（または挿入操作） → 即座に描画
    if (text === "") return;

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

    parseText();
  }, [text]);

  //データをマークダウンからHTMLに変換
  // lineNumbers=true のとき parseWithSourceLines を使い data-src-line 属性を付与する（プレビュー用）
  const createMarked = async (id, txt, local, lineNumbers = false) => {
    var p = ""
    var parseError = false;
    var warnings = [];
    const result = await ParseNote(id, local, txt);
    if (result.error) {
      setParseStatus({ status: "error", err: result.error, warnings: result.warnings || [] });
      parseError = true;
      p = txt;
    } else {
      p = result.html;
      warnings = result.warnings || [];
    }

    var val = lineNumbers ? await Marked.parseWithSourceLines(p) : await Marked.parse(p);
    return { html: val || "", parseError, warnings };
  }

  /**
   * HTMLの表示
   */
  const viewHTML = async (txt, embNoteElm) => {

    if (mode === "note") {

      var result = await createMarked(id, txt, true, true);
      const noteResult = await CreateNoteHTML(id, true, result.html);
      const allWarnings = [...(result.warnings || []), ...(noteResult.warnings || [])];
      if (noteResult.error) {
        setParseStatus({ status: "error", err: noteResult.error, warnings: allWarnings });
      } else {
        setHTML(noteResult.html);
        if (!result.parseError) {
          if (allWarnings.length > 0) {
            setParseStatus({ status: "warning", err: null, warnings: allWarnings });
          } else {
            setParseStatus({ status: "success", err: null, warnings: [] });
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

    const diagramResult = await ParseDiagram(id, true, txt);
    if (diagramResult.error) {
      setParseStatus({ status: "error", err: diagramResult.error, warnings: diagramResult.warnings || [] });
      return;
    }
    let parsedTxt = diagramResult.html;
    const diagWarnings = diagramResult.warnings || [];

    Mermaid.parse(parsedTxt, styleTemplateId).then((data) => {

      var elm = document.querySelector('#mermaidViewer');
      if (!elm) return;
      elm.innerHTML = data.svg;
      if (diagWarnings.length > 0) {
        setParseStatus({ status: "warning", err: null, warnings: diagWarnings });
      } else {
        setParseStatus({ status: "success", err: null, warnings: [] });
      }
      Events.Emit('binder:preview:update', { typ: mode, id, name, html: parsedTxt, styleTemplateId });

      var svg = document.querySelector('#mermaidViewer svg');
      var left = 0;
      var top = 0;
      var scale = 1.0;

      var transform = function () {
        var px = left + 'px';
        var py = top + 'px';
        svg.style.transform = `translate(${px},${py}) scale(${scale})`;
      }

      // ホイールクリック（中ボタン）でドラッグ移動。AssetViewer/LayerEditor と統一。
      svg.addEventListener("pointerdown", function (event) {
        if (event.button !== 1) return;
        event.preventDefault(); // ブラウザのオートスクロールモードを抑制
        elm.style.cursor = 'grabbing';
      });
      svg.addEventListener("pointermove", function (event) {
        if (!(event.buttons & 4)) return; // 中ボタン押下中のみ
        left = (left + event.movementX);
        top = (top + event.movementY);
        transform();
      });
      svg.addEventListener("pointerup", function (event) {
        if (event.button === 1) elm.style.cursor = '';
      });

      //Wheelによる拡大
      svg.addEventListener("wheel", function (event) {
        var dy = event.deltaY;
        var s = 0.1;
        if (dy > 0) {
          s *= -1;
        }
        scale += s;
        transform();
      });

      transform();

    }).catch((err) => {
      setParseStatus({ status: "error", err, warnings: diagWarnings });
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

  // ---- エディタ/ビューア間スプリッタードラッグ ----
  // Pointer Capture を使用: iframeをまたいでもイベントが途切れない
  const splitterRef = useRef(null);
  const splitStartRef = useRef(null);

  const handleSplitterPointerDown = (e) => {
    if (!viewer) return;
    e.preventDefault();
    splitStartRef.current = { startX: e.clientX, startWidth: width };
    splitterRef.current.setPointerCapture(e.pointerId);
    document.getElementById('editorContent')?.classList.add('no-transition');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSplitterPointerMove = (e) => {
    if (!splitStartRef.current) return;
    const delta = e.clientX - splitStartRef.current.startX;
    const newWidth = Math.max(100, splitStartRef.current.startWidth + delta);
    // ドラッグ中は state を更新せず DOM を直接書き換え、巨大な Editor の再レンダーを回避する。
    // 最終値は pointerup で一度だけ setWidth して確定する。
    splitStartRef.current.lastWidth = newWidth;
    const wrapper = document.getElementById('editorWrapper');
    if (wrapper) wrapper.style.width = (newWidth - 4) + 'px';
  };

  const handleSplitterPointerUp = () => {
    if (!splitStartRef.current) return;
    const finalWidth = splitStartRef.current.lastWidth;
    splitStartRef.current = null;
    if (finalWidth != null) setWidth(finalWidth);
    document.getElementById('editorContent')?.classList.remove('no-transition');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // ---- ツリー/エディタ間スプリッタードラッグ ----
  const treeSplitterRef = useRef(null);
  const treeSplitStartRef = useRef(null);

  const handleTreeSplitterPointerDown = (e) => {
    if (!treeVisible) return;
    e.preventDefault();
    treeSplitStartRef.current = { startX: e.clientX, startWidth: treeWidth };
    treeSplitterRef.current.setPointerCapture(e.pointerId);
    document.getElementById('splitScreen')?.classList.add('no-transition');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleTreeSplitterPointerMove = (e) => {
    if (!treeSplitStartRef.current) return;
    const delta = e.clientX - treeSplitStartRef.current.startX;
    const newWidth = Math.max(80, treeSplitStartRef.current.startWidth + delta);
    // ドラッグ中は state を更新せず DOM を直接書き換え、ツリー・エディタの再レンダーを回避する。
    treeSplitStartRef.current.lastWidth = newWidth;
    const panel = document.getElementById('editorTreePanel');
    if (panel) panel.style.width = newWidth + 'px';
  };

  const handleTreeSplitterPointerUp = () => {
    if (!treeSplitStartRef.current) return;
    const finalWidth = treeSplitStartRef.current.lastWidth;
    treeSplitStartRef.current = null;
    if (finalWidth != null) setTreeWidth(finalWidth);
    document.getElementById('splitScreen')?.classList.remove('no-transition');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };


  /**
   * カーソル移動時にプレビューのスクロール位置を追従させる（ノートモードのみ）
   */
  const handleCursorMove = useCallback((e) => {
    if (modeRef.current !== Mode.note) return;
    const textarea = e.target;
    const line = textarea.value.substring(0, textarea.selectionStart).split('\n').length;
    if (line !== cursorLineRef.current) {
      cursorLineRef.current = line;
      setCursorLine(line);
    }
  }, []);

  /**
   * テキストの変更
   */
  const handleChangeText = (e) => {

    // ユーザー入力フラグを立てる（useEffect[text] でデバウンスを選択させる）
    isEditingRef.current = true;
    var txt = e.target.value;
    // カーソル行を記録（デバウンス後の parseText で使用する）
    cursorLineRef.current = txt.substring(0, e.target.selectionStart).split('\n').length;
    setText(txt);

    setUpdated(true);
    writeFn(mode, id, txt).then(() => {
      console.debug("Write!");
      evt.markModified(id);
      evt.markPublishDirty(id);
    }).catch((err) => {;
      evt.showErrorMessage(err);
    });
  }

  const handleOpenInBrowser = () => {
    if (!alias || !serverAddress) return;
    if (mode === Mode.note) {
      Browser.OpenURL(id === "index" ? `${serverAddress}/` : `${serverAddress}/pages/${alias}.html`);
    } else if (mode === Mode.diagram) {
      Browser.OpenURL(`${serverAddress}/images/${alias}.svg`);
    }
  };

  //出力処理
  const handlePublish = async () => {
    try {
      var elm = "";
      if (mode === Mode.note) {
        elm = (await createMarked(id, text, false)).html;
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

      await Generate(mode, id, elm);
      evt.reloadUnpublished();
      evt.showSuccessMessage("Generate.");
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
  const handleCommit = () => {
    Commit(mode, id, comment).then(() => {
      setUpdated(false);
      evt.commitDone();
      evt.showSuccessMessage("Commit.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //SVG のダウンロードを行う
  const handleDownload = async () => {
    if (mode === Mode.diagram) {
      var elm = document.querySelector('#mermaidViewer');
      var data = new Blob([elm.innerHTML], { type: 'image/svg+xml' });
      var dataURL = window.URL.createObjectURL(data);
      var tempLink = document.createElement('a');
      tempLink.href = dataURL;
      tempLink.setAttribute('download', name + '.svg');
      tempLink.click();
    } else if (mode === Mode.note) {
      var data = new Blob([html], { type: 'text/html' });
      var dataURL = window.URL.createObjectURL(data);
      var tempLink = document.createElement('a');
      tempLink.href = dataURL;
      tempLink.setAttribute('download', name + '.html');
      tempLink.click();
    }
  }

  /** Blob を生成してテキストファイルをダウンロードする */
  const triggerTextDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
  };

  /** テキストをそのままダウンロード（テキストステートから直接） */
  const handleDownloadRaw = () => {
    closeEditorMoreMenu();
    if (mode === Mode.note) {
      triggerTextDownload(text, name + '.md');
    } else if (mode === Mode.diagram) {
      triggerTextDownload(text, name + '.mmd');
    }
  };

  /** テンプレート関数を展開したテキストをダウンロード（HTML変換前） */
  const handleDownloadExpanded = async () => {
    closeEditorMoreMenu();
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
    writeFn(mode, id, textarea.value);
  };

  /**
   * ファイルドロップ許可
   */
  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  }

  /**
   * エディタへのファイルドロップ処理
   * 画像: {{assetsImage "id"}} を挿入
   * その他: {{assets "id"}} を挿入
   */
  const handleDrop = (e) => {
    if (mode !== Mode.note) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    e.preventDefault();

    // ドロップ時点のカーソル位置を記録（非同期処理前に取得）
    const dropPos = e.currentTarget.selectionStart;

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const filename = file.name || `drop-${Date.now()}`;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        if (!base64) {
          evt.showWarningMessage(t('editor.fileDataEmpty'));
          return;
        }

        const asset = {
          Id: '',
          ParentId: id,
          Name: filename,
          Alias: filename,
          Detail: '',
          Binary: false,
        };

        DropAsset(asset, filename, base64).then((result) => {
          evt.refreshTree();
          if (result?.id) {
            const tag = isImage
              ? `{{assetsImage "${result.id}" ""}}`
              : `{{assets "${result.id}"}}`;
            const ta = document.querySelector('#editor');
            if (!ta) return;
            const val = ta.value;
            const before = val.substring(0, dropPos);
            const after = val.substring(dropPos);
            const newVal = before + tag + after;
            ta.value = newVal;
            ta.selectionStart = dropPos + tag.length;
            ta.selectionEnd = dropPos + tag.length;
            requestAnimationFrame(() => {
              setText(newVal);
              writeFn(mode, id, newVal);
            });
          }
        }).catch((err) => {
          evt.showErrorMessage(err);
        });
      };
      reader.readAsDataURL(file);
    });
  }

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
      writeFn(mode, id, val);
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

  const handleKeyDown = (e) => {
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
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
      writeFn(mode, id, result.value);
      requestAnimationFrame(() => {
        textarea.selectionStart = result.cursor;
        textarea.selectionEnd = result.cursor;
      });
    }
  }

  /**
   * エディタを起動
   */
  const handleRunEditor = () => {

    setEditorLocked(true);

    // 外部エディタ起動中にファイル変更をポーリングして反映
    const lastTextRef = { current: text };
    const sec = 2;
    const openFn = mode === Mode.note ? OpenNote
                 : mode === Mode.diagram ? OpenDiagram
                 : mode === Mode.template ? OpenTemplate : null;

    var interval = setInterval(function () {
      if (!openFn) return;
      openFn(id).then((resp) => {
        if (resp !== lastTextRef.current) {
          lastTextRef.current = resp;
          setText(resp);
        }
      }).catch(() => {});
    }, 1000 * sec)

    RunEditor(mode, id).then(() => {
      clearInterval(interval)
      // プロセス終了後にファイルを再読み込み
      if (openFn) {
        openFn(id).then((resp) => setText(resp)).catch((err) => evt.showErrorMessage(err));
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
      clearInterval(interval)
    }).finally(() => {
      clearInterval(interval)
      setEditorLocked(false);
    })
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
      writeFn(mode, id, newText);
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

  /**
   * 初回起動のみのエフェクト
   */
  useEffect(() => {
    // サイドバートグルでツリーパネルの表示/非表示を切り替える
    evt.register("Editor", Event.ShowMenu, function (flag) {
      setTreeVisible(flag);
    });

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
        setViewer(e.showPreview);
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
      ...overrides,
    };
    editorSettingRef.current = editor;
    SaveEditor(editor).then(() => {
      Events.Emit('binder:editor:settingChanged', {
        showLineNumbers: editor.showLineNumbers,
        wordWrap: editor.wordWrap,
        showPreview: editor.showPreview,
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
            {mode === Mode.template ? <TemplateTree /> : <BinderTree />}
          </div>
        )}

        {/** ツリー/エディタ間スプリッター */}
        {showTree && (
          <div
            ref={treeSplitterRef}
            id="treeSplitter"
            className={!treeVisible ? 'hidden' : ''}
            onPointerDown={handleTreeSplitterPointerDown}
            onPointerMove={handleTreeSplitterPointerMove}
            onPointerUp={handleTreeSplitterPointerUp}
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
              <Container id="editorMenu">
                <Container className="buttonBarLeft">

                  {/** 行番号表示トグル */}
                  <Tooltip title={showLineNumbers ? t("editor.lineNumberOn") : t("editor.lineNumberOff")} placement="bottom">
                    <ToggleButton
                      value="lineNumbers"
                      selected={showLineNumbers}
                      size="small"
                      onChange={() => { setShowLineNumbers(v => !v); saveEditorSetting({ showLineNumbers: !showLineNumbers }); }}
                      sx={{
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: showLineNumbers ? 'var(--text-primary)' : 'var(--text-muted)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: 'var(--text-primary)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
                        },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                        mr: '2px',
                      }}
                    >
                      <FormatListNumberedIcon sx={{ fontSize: '16px' }} />
                    </ToggleButton>
                  </Tooltip>

                  {/** スニペット挿入 */}
                  {snippetList.length > 0 && (<>
                    {/** 区切り */}
                    <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />
                    <Tooltip title={t("editor.insertSnippet")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="snippet" sx={{ mr: 2 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => setSnippetAnchor(e.currentTarget)}
                        className="editorBtn">
                        <PlaylistAddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Menu
                      anchorEl={snippetAnchor}
                      open={Boolean(snippetAnchor)}
                      onClose={() => setSnippetAnchor(null)}
                      disableAutoFocus
                      disableEnforceFocus
                      disableRestoreFocus
                      PaperProps={{ sx: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-input)', maxHeight: 300 } }}
                    >
                      {snippetList.map((s) => (
                        <MenuItem key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertSnippet(s.body)}
                          sx={{ fontSize: '13px', '&:hover': { backgroundColor: 'var(--hover-menuitem)' } }}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>)}

                  {/** ID挿入 */}
                  <Tooltip title={t("editor.insertId")} placement="bottom">
                    <IconButton size="small" edge="start" color="inherit" aria-label="insert-id" sx={{ mr: 2 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        const anchor = e.currentTarget;
                        GetBinderTree().then((tree) => {
                          const all = flattenStructures(tree.data || []);
                          const children = all.filter((s) => s.parentId === id);
                          const others = all.filter((s) => s.parentId !== id && s.id !== id);
                          setIdList([...children, ...others]);
                          setIdListAnchor(anchor);
                        }).catch((err) => evt.showErrorMessage(err));
                      }}
                      className="editorBtn">
                      <NewLabelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={idListAnchor}
                    open={Boolean(idListAnchor)}
                    onClose={() => setIdListAnchor(null)}
                    disableAutoFocus
                    disableEnforceFocus
                    disableRestoreFocus
                    PaperProps={{ sx: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-input)', maxHeight: 300 } }}
                  >
                    {idList.map((s) => (
                      <MenuItem key={s.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { handleInsertSnippet(s.id); setIdListAnchor(null); }}
                        sx={{ fontSize: '13px', '&:hover': { backgroundColor: 'var(--hover-menuitem)' } }}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Menu>

                  {/** マークダウン書式ボタン（ノート編集時のみ表示） */}
                  {mode === Mode.note && <>
                    {/** 区切り */}
                    <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />

                    {/** 強調 */}
                    <Tooltip title={t("editor.bold")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="bold" sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handleInsert("**", "**")} className="editorBtn">
                        <FormatBoldIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/** イタリック */}
                    <Tooltip title={t("editor.italic")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="italic" sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handleInsert("*", "*")} className="editorBtn">
                        <FormatItalicIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/** 打ち消し線 */}
                    <Tooltip title={t("editor.strikethrough")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="strike" sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handleInsert("~~", "~~")} className="editorBtn">
                        <FormatStrikethroughIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/** コードブロック */}
                    <Tooltip title={t("editor.codeBlock")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="code" sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handleInsert("\n```\n", "\n```\n")} className="editorBtn">
                        <CodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/** 引用 */}
                    <Tooltip title={t("editor.quote")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="code" sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => handleInsert("> ")} className="editorBtn">
                        <FormatQuoteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />

                    {/** テーブル編集 */}
                    <Tooltip title={t("editor.tableEdit")} placement="bottom">
                      <IconButton size="small" edge="start" color="inherit" aria-label="table-edit" sx={{ mr: 2 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleTableEdit} className="editorBtn">
                        <TableChartIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>}

                </Container>

                <Container className="buttonBarRight">

                  {/** テキスト折り返しトグル */}
                  <Tooltip title={wordWrap ? t("editor.wordWrapOn") : t("editor.wordWrapOff")} placement="bottom">
                    <ToggleButton
                      value="wordWrap"
                      selected={wordWrap}
                      size="small"
                      onChange={() => { setWordWrap(v => !v); saveEditorSetting({ wordWrap: !wordWrap }); }}
                      sx={{
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: wordWrap ? 'var(--text-primary)' : 'var(--text-muted)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: 'var(--text-primary)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
                        },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                        mr: '2px',
                      }}
                    >
                      <WrapTextIcon sx={{ fontSize: '16px' }} />
                    </ToggleButton>
                  </Tooltip>


                  {/** プレビュー表示トグル */}
                  <Tooltip title={viewer ? t("editor.previewOn") : t("editor.previewOff")} placement="bottom">
                    <ToggleButton
                      value="viewer"
                      selected={viewer}
                      size="small"
                      onChange={() => { setViewer(v => !v); saveEditorSetting({ showPreview: !viewer }); }}
                      sx={{
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: viewer ? 'var(--text-primary)' : 'var(--text-muted)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: 'var(--text-primary)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
                        },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      <VisibilityIcon sx={{ fontSize: '16px' }} />
                    </ToggleButton>
                  </Tooltip>

                  {/** 区切り */}
                  <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />

                  {/** MoreVert メニューボタン */}
                  <Tooltip title={t("editor.menu")} placement="bottom">
                    <IconButton
                      size="small"
                      onClick={(e) => openEditorMoreMenu(e.currentTarget)}
                      sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' }, padding: '5px 0px' }}
                      className="editorBtn"
                    >
                      <MoreVertIcon sx={{ fontSize: '18px' }} />
                    </IconButton>
                  </Tooltip>

                </Container>
              </Container>

              {/** エディタ MoreVert ドロップダウンメニュー */}
              <Menu
                open={editorMoreMenu.open}
                anchorEl={editorMoreMenu.el ?? undefined}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                onClose={closeEditorMoreMenu}
                slotProps={{ paper: { sx: { minWidth: 160 } } }}
              >
                <MenuItem onClick={() => { closeEditorMoreMenu(); handleFontDialog(); }}>
                  <FontDownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("editor.fontSetting")}
                </MenuItem>
                <MenuItem onClick={() => { closeEditorMoreMenu(); handleRunEditor(); }}>
                  <LaunchIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("editor.openExternalEditor")}
                </MenuItem>
                {(mode === Mode.note || mode === Mode.diagram) && <Divider />}
                {(mode === Mode.note || mode === Mode.diagram) && (
                  <MenuItem onClick={(e) => { e.stopPropagation(); setTextDownloadMenuAnchor(e.currentTarget); }} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><DownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.download")}</span><span>▶</span>
                  </MenuItem>
                )}
              </Menu>

              {/** テキストダウンロードサブメニュー */}
              <Menu
                open={Boolean(textDownloadMenuAnchor)}
                onClose={closeEditorMoreMenu}
                anchorEl={textDownloadMenuAnchor}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { minWidth: 180 } } }}
              >
                <MenuItem onClick={handleDownloadRaw}>{t("tree.downloadText")}</MenuItem>
                <MenuItem onClick={handleDownloadExpanded}>{t("tree.downloadExpanded")}</MenuItem>
              </Menu>

              {/** テキスト検索フローティングパネル（Ctrl+F） */}
              {searchOpen && (
                <SearchBar
                  key={restoredAt}
                  text={text}
                  onClose={() => { setSearchOpen(false); setActiveMatchLine(null); }}
                  onNavigate={handleSearchNavigate}
                  onClearHighlight={() => setActiveMatchLine(null)}
                  initialQuery={searchQuery}
                />
              )}

              {/** テキスト編集（行番号ガター + textarea） */}
              <EditorArea
                text={text}
                style={editorStyle}
                showLineNumbers={showLineNumbers}
                wordWrap={wordWrap}
                activeLine={activeMatchLine}
                onKeyDown={handleKeyDown}
                onChange={handleChangeText}
                onPaste={handlePaste}
                onCursorMove={handleCursorMove}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />

              {/** コミットバー */}
              <CommitBar
                comment={comment}
                onCommentChange={setComment}
                updated={updated}
                onCommit={handleCommit}
              />
            </div>
          }

          {/** セパレータ（エディタ/ビューア間） */}
          {editor &&
            <div ref={splitterRef} id="splitter"
              className={!viewer ? 'hidden' : ''}
              onPointerDown={handleSplitterPointerDown}
              onPointerMove={handleSplitterPointerMove}
              onPointerUp={handleSplitterPointerUp}
            />
          }

          {/** 表示側 */}
            <div id="dataViewer" className={!viewer ? 'hidden' : ''}>

              {/** プレビューメニュー */}
              <div id="previewMenu">
                {mode === Mode.template && (() => {
                  if (templateType === "diagram") {
                    return (
                      <div className="previewMenuLeft">
                        <Select
                          value={previewDiagramId}
                          onChange={(e) => { lastPreviewDiagramId = e.target.value; setPreviewDiagramId(e.target.value); }}
                          size="small"
                          displayEmpty
                          sx={{ minWidth: 120, height: "26px", fontSize: "0.78rem", color: "var(--text-primary)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border-strong)" }, "& .MuiSelect-select": { padding: "2px 8px" } }}
                        >
                          {previewDiagrams.map((d) => (
                            <MenuItem key={d.id} value={d.id} sx={{ fontSize: "0.8rem" }}>{d.name}</MenuItem>
                          ))}
                        </Select>
                      </div>
                    );
                  }
                  const previewOtherTemplates = templateType === "layout" ? previewContents : previewLayouts;
                  return (
                    <div className="previewMenuLeft">
                      <Select
                        value={previewOtherTemplateId}
                        onChange={(e) => { lastPreviewOtherTemplateId = e.target.value; setPreviewOtherTemplateId(e.target.value); }}
                        size="small"
                        displayEmpty
                        sx={{ minWidth: 120, height: "26px", fontSize: "0.78rem", color: "var(--text-primary)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border-strong)" }, "& .MuiSelect-select": { padding: "2px 8px" }, mr: '6px' }}
                      >
                        {previewOtherTemplates.map((t) => (
                          <MenuItem key={t.id} value={t.id} sx={{ fontSize: "0.8rem" }}>{t.name}</MenuItem>
                        ))}
                      </Select>
                      <Select
                        value={previewNoteId}
                        onChange={(e) => { lastPreviewNoteId = e.target.value; setPreviewNoteId(e.target.value); }}
                        size="small"
                        displayEmpty
                        sx={{ minWidth: 120, height: "26px", fontSize: "0.78rem", color: "var(--text-primary)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border-strong)" }, "& .MuiSelect-select": { padding: "2px 8px" } }}
                      >
                        {previewNotes.map((n) => (
                          <MenuItem key={n.id} value={n.id} sx={{ fontSize: "0.8rem" }}>{n.name}</MenuItem>
                        ))}
                      </Select>
                    </div>
                  );
                })()}
                {mode !== Mode.template && <div className="previewMenuLeft" />}
                <div className="previewMenuRight">
                  {colorSchemeConfig && colorSchemeConfig.values.length > 0 &&
                    <Tooltip title={`${t("preview.colorScheme")}: ${colorSchemeConfig.values[colorSchemeIndex]}`} placement="bottom">
                      <IconButton size="small" aria-label="color-scheme" className="editorBtn"
                        onClick={() => setColorSchemeIndex((prev) => (prev + 1) % colorSchemeConfig.values.length)}
                      >
                        <ContrastIcon sx={{ fontSize: '16px' }} />
                      </IconButton>
                    </Tooltip>
                  }
                  {mode !== Mode.template &&
                    <Tooltip title={t("preview.download")} placement="bottom">
                      <IconButton size="small" aria-label="download" onClick={handleDownload} className="editorBtn">
                        <DownloadIcon sx={{ fontSize: '16px' }} />
                      </IconButton>
                    </Tooltip>
                  }
                  {mode === Mode.note &&
                    <Tooltip title={t("preview.downloadZip")} placement="bottom">
                      <IconButton size="small" aria-label="download-zip" onClick={handleDownloadZip} className="editorBtn">
                        <FolderZipIcon sx={{ fontSize: '16px' }} />
                      </IconButton>
                    </Tooltip>
                  }
                  {mode !== Mode.template &&
                    <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />
                  }
                  {mode !== Mode.template &&
                    <IconButton
                      size="small"
                      onClick={(e) => openPreviewMoreMenu(e.currentTarget)}
                      sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' }, padding: '5px 0px' }}
                    >
                      <MoreVertIcon sx={{ fontSize: '18px' }} />
                    </IconButton>
                  }
                </div>
              </div>

              {/** プレビュー MoreVert ドロップダウンメニュー */}
              <Menu
                open={previewMoreMenu.open}
                anchorEl={previewMoreMenu.el ?? undefined}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                onClose={closePreviewMoreMenu}
                slotProps={{ paper: { sx: { minWidth: 160 } } }}
              >
                <MenuItem onClick={() => { closePreviewMoreMenu(); OpenPreviewWindow(mode, id, name); }} disabled={mode === Mode.template}>
                  <PreviewIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.openPreviewWindow")}
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { closePreviewMoreMenu(); handlePublish(); }} disabled={parseStatus.status === "error" || isPrivate}>
                  <PublishIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.publish")}
                </MenuItem>
                <MenuItem onClick={() => { closePreviewMoreMenu(); handleOpenInBrowser(); }} disabled={!alias || mode === Mode.template}>
                  <OpenInBrowserIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.openBrowser")}
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { closePreviewMoreMenu(); handleUnpublish(); }}>
                  <UnpublishedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.unpublish")}
                </MenuItem>
              </Menu>

              {/** プレビューコンテンツ */}
              <div id="previewContent">
                {(mode === Mode.note) &&
                  <HTMLFrame html={html} cursorLine={cursorLine} colorSchemeAttr={colorSchemeConfig?.attribute} colorSchemeValue={colorSchemeConfig?.values[colorSchemeIndex]} />
                }
                {mode === Mode.diagram &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType === "diagram" &&
                  <div id="mermaidViewer"></div>
                }
                {mode === Mode.template && templateType !== "diagram" &&
                  <HTMLFrame html={html} cursorLine={cursorLine} colorSchemeAttr={colorSchemeConfig?.attribute} colorSchemeValue={colorSchemeConfig?.values[colorSchemeIndex]} />
                }
              </div>

              {/** パースステータスバー */}
              <div id="parseStatusBar">
                <div className="parseStatusLeft" onDoubleClick={() => {
                  if (parseStatus.err) setParseErrorDlg(true);
                  else if (parseStatus.warnings?.length > 0) setParseWarningDlg(true);
                }}>
                  {parseStatus.status === "error"
                    ? <><ErrorIcon sx={{ fontSize: '16px', color: 'var(--accent-red)', mr: '6px' }} /><span className="parseStatusText">{t("preview.parseError")}</span></>
                    : parseStatus.status === "warning"
                    ? <><WarningAmberIcon sx={{ fontSize: '16px', color: 'var(--accent-warning, orange)', mr: '6px' }} /><span className="parseStatusText">Warning ({parseStatus.warnings?.length})</span></>
                    : <><CheckCircleIcon sx={{ fontSize: '16px', color: 'var(--accent-green)', mr: '6px' }} /><span className="parseStatusText">Success</span></>
                  }
                </div>
              </div>

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

      {/** パースエラー詳細ダイアログ */}
      <Dialog open={parseErrorDlg} onClose={() => setParseErrorDlg(false)}>
        <DialogTitle>Parse Error</DialogTitle>
        <DialogContent>
          <DialogContentText className="messageTxt">
            {parseStatus.err ? String(parseStatus.err) : ""}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.close")} icon={<CloseIcon />} onClick={() => setParseErrorDlg(false)} />
        </DialogActions>
      </Dialog>

      {/** テンプレート関数警告ダイアログ */}
      <Dialog open={parseWarningDlg} onClose={() => setParseWarningDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Warnings ({parseStatus.warnings?.length || 0})</DialogTitle>
        <DialogContent>
          {(parseStatus.warnings || []).map((w, i) => (
            <DialogContentText key={i} className="messageTxt" sx={{ fontSize: '13px', mb: '4px', color: 'var(--text-secondary)' }}>
              {w}
            </DialogContentText>
          ))}
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.close")} icon={<CloseIcon />} onClick={() => setParseWarningDlg(false)} />
        </DialogActions>
      </Dialog>

      {/** 未公開確認ダイアログ */}
      <Dialog open={unpublishConfirm} onClose={() => setUnpublishConfirm(false)}>
        <DialogTitle>{t("preview.unpublishConfirm")}</DialogTitle>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishConfirm(false)} />
          <ActionButton variant="delete" label={t("preview.unpublish")} icon={<UnpublishedIcon />} onClick={doUnpublish} />
        </DialogActions>
      </Dialog>

      {/** 外部エディタ実行中ロック */}
      <Backdrop open={editorLocked} sx={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <span style={{ color: '#fff', fontSize: '14px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '40px', borderRadius: '10px' }}>{t("editor.externalEditorLocked")}</span>
      </Backdrop>
    </>
  );
}

export default Editor;
