import { useState, useEffect, useContext, useRef, useCallback } from "react"
import { useParams, useLocation } from "react-router";

import { Container, IconButton, Menu, MenuItem, Paper, TextField, Toolbar, InputAdornment, Divider, Select } from "@mui/material";

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../../bindings/binder/api/app";
import { GetDiagram, OpenDiagram, SaveDiagram } from "../../../bindings/binder/api/app";
import { GetTemplate, OpenTemplate, SaveTemplate } from "../../../bindings/binder/api/app";
import { GetHTMLTemplates, GetBinderTree, CreateTemplateHTML } from "../../../bindings/binder/api/app";
import { GetAsset, Generate, Unpublish, Commit, DropAsset } from "../../../bindings/binder/api/app";
import { RunEditor, GetSetting, SaveSetting, GetSnippets } from "../../../bindings/binder/api/app";

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";

import Event, { EventContext } from "../../Event.jsx";

import HTMLFrame from "./HTMLFrame.jsx";
import '../../assets/Editor.css'
import { Mode } from "../../App.jsx";

import CommitIcon from '@mui/icons-material/Commit';
import DownloadIcon from '@mui/icons-material/Download';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import LaunchIcon from '@mui/icons-material/Launch';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import PreviewIcon from '@mui/icons-material/Preview';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FontDialog from "../FontDialog.jsx";

import BinderTree from "../LeftMenu/BinderTree.jsx";
import AssetViewer from "../AssetViewer.jsx";

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
 * テンプレートプレビューHTMLを生成する
 */
async function runTemplatePreview(templateId, templateType, otherTemplateId, noteId) {
  const content = await OpenNote(noteId);
  const parsed = await ParseNote(noteId, true, content);
  const marked = await Marked.parse(parsed);
  return await CreateTemplateHTML(templateId, templateType, otherTemplateId, noteId, marked);
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
  const evt = useContext(EventContext)

  const [editor, setEditor] = useState(true);
  const [viewer, setViewer] = useState(true);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  // エディタ/ビューア間のスプリッター幅（エディタ側の幅）
  const [width, setWidth] = useState(500);
  // ツリーパネルの表示状態と幅
  const [treeVisible, setTreeVisible] = useState(true);
  const [treeWidth, setTreeWidth] = useState(250);

  const [fontDialog, setShowFontDialog] = useState(false);

  // スニペット
  const [snippets, setSnippets] = useState({ markdowns: [], diagrams: [], templates: [] });
  const [snippetAnchor, setSnippetAnchor] = useState(null);

  // ユーザーがテキストを入力中かどうかのフラグ / デバウンスタイマー
  // handleChangeText だけが true にセットする。ファイルオープン時はセットされないので即時描画になる。
  const isEditingRef = useRef(false);
  const parseTimerRef = useRef(null);

  // 行番号ガター
  const lineNumbersRef = useRef(null);
  const canvasRef = useRef(null);
  // 各論理行が折り返して占める visual 行数
  const [lineHeights, setLineHeights] = useState([]);

  const [editorFont, setEditorFont] = useState(undefined);
  const [editorStyle, setEditorStyle] = useState({});

  //viewHTMLのprop
  const [html, setHTML] = useState("");
  //更新状態のアイコン
  const [updated, setUpdated] = useState(false);

  // テンプレートプレビュー用
  const [templateType, setTemplateType] = useState("");
  const [previewLayouts, setPreviewLayouts] = useState([]);
  const [previewContents, setPreviewContents] = useState([]);
  const [previewNotes, setPreviewNotes] = useState([]);
  const [previewNoteId, setPreviewNoteId] = useState("");
  const [previewOtherTemplateId, setPreviewOtherTemplateId] = useState("");

  //テキストにセンタリング用のタグを埋め込む
  const insertCenterTag = (txt) => {

    if (txt == null || txt === "") {
      return txt;
    }

    var len = txt.length;
    var e = document.querySelector("#editor");
    var pos = e.selectionStart;

    const lines = txt.split(/\n/, -1);

    var now = 0;
    var start = false;
    var b = false;

    for (const line of lines) {
      now += line.length + 1;

      if (line.indexOf("```") === 0) {
        if (start) {
          start = false;
        } else {
          start = true;
        }
      }

      if (now > pos) {
        b = true;
      }

      if (b && !start && line === "") {
        pos = now;
        break;
      }
    }

    var before = txt.substr(0, pos);
    var after = txt.substr(pos, len);
    var tag = '\n\n<div id="binder_focus_id"></div>\n\n';
    return before + tag + after;
  }

  //開いた時の初期処理
  useEffect(() => {

    evt.clearMessage();

    if (mode === Mode.diagram) {

      setEditor(true);
      setViewer(true);

      OpenDiagram(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

      GetDiagram(id).then((resp) => {
        if (resp.updatedStatus > 0) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }

        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.note) {

      setEditor(true);
      setViewer(true);

      OpenNote(id).then((resp) => {
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
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.template) {

      setEditor(true);
      setViewer(true);

      // プレビュー設定をリセット
      setPreviewOtherTemplateId("");
      setHTML("");

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
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

      // プレビュー用テンプレート一覧を取得
      GetHTMLTemplates().then((tmpls) => {
        setPreviewLayouts(tmpls.layouts ?? []);
        setPreviewContents(tmpls.contents ?? []);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      // プレビュー用ノート一覧を取得
      GetBinderTree().then((tree) => {
        const notes = flattenNotes(tree.data ?? []);
        setPreviewNotes(notes);
        if (notes.length > 0) {
          setPreviewNoteId(notes[0].id);
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
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    }

  }, [id, restoredAt]);

  // スニペットを一度だけロード
  useEffect(() => {
    GetSnippets().then((s) => setSnippets(s)).catch(() => { });
  }, []);

  // templateType が確定したら「もう一方のテンプレート」のデフォルトを設定
  useEffect(() => {
    if (!templateType) return;
    const others = templateType === "layout" ? previewContents : previewLayouts;
    if (others.length > 0) {
      setPreviewOtherTemplateId(others[0].id);
    }
  }, [templateType, previewLayouts, previewContents]);

  // プレビュー設定が揃ったら自動プレビュー
  useEffect(() => {
    if (mode !== Mode.template || !previewNoteId || !previewOtherTemplateId || !templateType) return;
    runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
      .then((result) => setHTML(result))
      .catch((err) => evt.showErrorMessage(err));
  }, [previewNoteId, previewOtherTemplateId]);

  // モードに対応するスニペット一覧
  const snippetList = (() => {
    if (mode === Mode.note) return snippets.markdowns ?? [];
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
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newVal = textarea.value.substring(0, start) + body + textarea.value.substring(end);
    const newPos = start + body.length;
    textarea.value = newVal;
    setText(newVal);
    setSnippetAnchor(null);
    requestAnimationFrame(() => {
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
    });
  };

  // エディタへのテキスト挿入イベントを購読
  // BinderTree などから {{assetImage "id"}} などのテキストをカーソル位置に挿入する
  useEffect(() => {
    evt.register('Editor', Event.InsertText, (text) => {
      const textarea = document.querySelector("#editor");
      if (!textarea) return;

      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const before = val.substring(0, start);
      const after = val.substring(end);

      textarea.value = before + text + after;
      textarea.selectionStart = start + text.length;
      textarea.selectionEnd = start + text.length;

      setTimeout(() => {
        setText(textarea.value);
      }, 500);
    });
  }, []);

  //名称が変更になった場合の処理
  useEffect(() => {
    evt.changeTitle(name)
    setComment("Updated: " + name);
  }, [name]);

  const parseText = async () => {
    if (text === "") {
      return;
    }

    if (mode === Mode.diagram) {
      viewDiagram(text);
    } else if (mode === Mode.note) {
      //公開時にここが入らないようにする
      viewHTML(insertCenterTag(text));
    } else if (mode === Mode.template) {
      //viewHTML(text, noteElm);
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
    parseText();
  }, [text]);

  //データをマークダウンからHTMLに変換
  const createMarked = async (id, txt, local) => {
    var p = ""
    await ParseNote(id, local, txt).then((resp) => {
      p = resp;
    }).catch((err) => {
      evt.showErrorMessage(err);
      p = txt;
    });

    var val = await Marked.parse(p);
    if (val) {
      return val;
    }
    return "";
  }

  /**
   * HTMLの表示
   */
  const viewHTML = async (txt, embNoteElm) => {

    if (mode === "note") {

      var embed = await createMarked(id, txt, true);
      CreateNoteHTML(id, embed).then((resp) => {
        setHTML(resp);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

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

    Mermaid.parse(txt).then((data) => {

      var elm = document.querySelector('#mermaidViewer');
      elm.innerHTML = data.svg;

      var svg = document.querySelector('#mermaidViewer svg');
      var left = 0;
      var top = 0;
      var scale = 1.0;

      var transform = function () {
        var px = left + 'px';
        var py = top + 'px';
        svg.style.transform = `translate(${px},${py}) scale(${scale})`;
      }

      //ドラッグ
      svg.addEventListener("pointermove", function (event) {
        if (!event.buttons) {
          return;
        }
        left = (left + event.movementX);
        top = (top + event.movementY);
        transform();
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
      evt.showWarningMessage("Diagram parse error:" + err);
    });
  }

  // ---- エディタ/ビューア間スプリッタードラッグ ----
  // Pointer Capture を使用: iframeをまたいでもイベントが途切れない
  const splitterRef = useRef(null);
  const splitStartRef = useRef(null);

  const handleSplitterPointerDown = (e) => {
    e.preventDefault();
    splitStartRef.current = { startX: e.clientX, startWidth: width };
    splitterRef.current.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSplitterPointerMove = (e) => {
    if (!splitStartRef.current) return;
    const delta = e.clientX - splitStartRef.current.startX;
    const newWidth = Math.max(100, splitStartRef.current.startWidth + delta);
    setWidth(newWidth);
  };

  const handleSplitterPointerUp = () => {
    if (!splitStartRef.current) return;
    splitStartRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // ---- ツリー/エディタ間スプリッタードラッグ ----
  const treeSplitterRef = useRef(null);
  const treeSplitStartRef = useRef(null);

  const handleTreeSplitterPointerDown = (e) => {
    e.preventDefault();
    treeSplitStartRef.current = { startX: e.clientX, startWidth: treeWidth };
    treeSplitterRef.current.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleTreeSplitterPointerMove = (e) => {
    if (!treeSplitStartRef.current) return;
    const delta = e.clientX - treeSplitStartRef.current.startX;
    const newWidth = Math.max(80, treeSplitStartRef.current.startWidth + delta);
    setTreeWidth(newWidth);
  };

  const handleTreeSplitterPointerUp = () => {
    if (!treeSplitStartRef.current) return;
    treeSplitStartRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };


  /**
   * テキストの変更
   */
  const handleChangeText = (e) => {

    // ユーザー入力フラグを立てる（useEffect[text] でデバウンスを選択させる）
    isEditingRef.current = true;
    var txt = e.target.value;
    setText(txt);

    writeFn(mode, id, txt).then(() => {
      console.log("Write!");
    }).catch((err) => {;
      evt.showErrorMessage(err);
    });
  }

  //出力処理
  const handlePublish = async () => {
    var elm = "";
    if (mode === Mode.note) {
      elm = await createMarked(id, text, false);
    } else if (mode === Mode.diagram) {
      var obj = await Mermaid.parse(text);
      elm = obj.svg
    } else if (mode === Mode.template) {
      elm = text;
    } else if (mode === Mode.asset) {
      elm = text;
    }

    //出力処理を行う
    Generate(mode, id, elm).then(() => {
      evt.showSuccessMessage("Generate.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //非公開処理
  const handleUnpublish = () => {
    Unpublish(mode, id).then(() => {
      evt.showSuccessMessage("Unpublish.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //個別コミットを行う
  const handleCommit = () => {
    Commit(mode, id, comment).then(() => {
      setUpdated(false);
      evt.showSuccessMessage("Commit.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //SVG のダウンロードを行う
  const handleDownload = async () => {
    var elm = document.querySelector('#mermaidViewer');
    var data = new Blob([elm.innerHTML], { type: 'image/svg+xml' });
    var dataURL = window.URL.createObjectURL(data);
    var tempLink = document.createElement('a');
    tempLink.href = dataURL;
    tempLink.setAttribute('download', name + '.svg');
    tempLink.click();
  }

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
          evt.showWarningMessage('ファイルデータが空です');
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
              ? `{{assetsImage "${result.id}"}}`
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
            setTimeout(() => setText(newVal), 500);
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
    var textarea = document.querySelector("#editor");
    const val = textarea.value;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    var rtn = val;

    const before = val.substring(0, start)
    const text = val.substring(start, end)
    const after = val.substring(end)

    //終了の指示がある場合、
    if (e !== undefined) {
      rtn = before + s + text + e + after;
    } else {
      var buf = "\n";

      const lines = text.split("\n");
      lines.forEach(line => {
        buf += s + line + "\n";
      });

      buf += "\n";
      rtn = before + buf + after;
    }

    textarea.value = rtn;
    setTimeout(function () {
      setText(textarea.value);
    }, 500)

  }

  /**
   * Canvas でテキスト幅を計測し、各論理行の折り返し visual 行数を算出
   */
  const calcLineHeights = useCallback(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const ctx = canvasRef.current.getContext('2d');
    const style = window.getComputedStyle(textarea);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const availWidth = textarea.clientWidth - paddingLeft - paddingRight;
    if (availWidth <= 0) return;

    const heights = text.split('\n').map(line => {
      if (line === '') return 1;
      return Math.max(1, Math.ceil(ctx.measureText(line).width / availWidth));
    });
    setLineHeights(heights);
  }, [text, editorStyle]);

  // テキスト・フォント変更時に再計算
  useEffect(() => {
    calcLineHeights();
  }, [calcLineHeights]);

  // textarea のリサイズ時に再計算（スプリッター操作など）
  useEffect(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    const observer = new ResizeObserver(calcLineHeights);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [calcLineHeights]);

  /**
   * テキストエリアのスクロールに合わせて行番号ガターを同期
   */
  const handleEditorScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  /**
   * Enter時にインデントを挿入
   */
  const handleKeyDown = (e) => {

    const textarea = e.target;
    const val = textarea.value;

    if (e.key !== "Enter") {
      return;
    }
    e.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const before = val.substring(0, start)
    const after = val.substring(end)

    var indent = "";
    var char = "";
    //文字列の前方の状態を確認
    const last = before.lastIndexOf('\n')
    if (last !== -1) {
      const line = before.substring(last + 1);
      for (let idx = 0; idx < line.length; ++idx) {
        var c = line[idx]
        if (c !== " ") {
          if (c === "-") {
            char = "- ";
          } else if (c === ">") {
            char = "> ";
          } else if (c === "1") {
            var c2 = line[idx + 1];
            if (c2 === ".") {
              char = "1. ";
            }
          }
          break;
        }
        indent += " ";
      }
    }

    var at = "\n" + indent + char;
    const newCursor = start + at.length;

    textarea.value = before + at + after;
    textarea.selectionStart = newCursor;
    textarea.selectionEnd = newCursor;

    // isEditingRef を立ててデバウンスを有効化し、即時 setText する。
    // setTimeout を使うと次の Enter 連打時に React 再レンダリングでカーソルが末尾に飛ぶため、
    // requestAnimationFrame で再レンダリング後にカーソル位置を復元する。
    isEditingRef.current = true;
    setText(textarea.value);
    requestAnimationFrame(() => {
      textarea.selectionStart = newCursor;
      textarea.selectionEnd = newCursor;
    });
  }

  /**
   * エディタを起動
   */
  const handleRunEditor = () => {

    const sec = 2;
    var interval = setInterval(function () {
      // ファイルの内容を取得
    }, 1000 * sec)

    RunEditor(mode, id).then(() => {
      clearInterval(interval)
    }).catch((err) => {
      evt.showErrorMessage(err);
      clearInterval(interval)
    }).finally(() => {
      console.log("finally");
      clearInterval(interval)
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

    if (save) {
      GetSetting().then((s) => {
        s.lookAndFeel.editor.text = set;
        SaveSetting(s).then(() => {
        })
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

    //設定を取得
    GetSetting().then((s) => {
      var set = s.lookAndFeel.editor.text;
      settingFont(set);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

  }, []);

  var commentStyle = {};
  commentStyle.fontSize = "12px";
  commentStyle.paddingTop = "12px";
  commentStyle.width = (width - 98) + "px";

  var color = "#f1f1f1";
  if (updated) {
    color = "#f5a623";
  }

  //コミット用のアイコン(コメント欄の横)
  const commitIcon = (
    <InputAdornment position="end" className="linkBtn">
      <CommitIcon fontSize="small" style={{ color: color }} onClick={handleCommit}> </CommitIcon>
    </InputAdornment>
  )

  // template 以外のエディタルートではツリーパネルを表示する
  const showTree = mode !== Mode.template;

  return (
    <>
      <Paper id="splitScreen">

        {/** ツリーパネル（template モード以外） */}
        {showTree && treeVisible && (
          <div id="editorTreePanel" style={{ width: treeWidth + 'px' }}>
            <BinderTree />
          </div>
        )}

        {/** ツリー/エディタ間スプリッター */}
        {showTree && treeVisible && (
          <div
            ref={treeSplitterRef}
            id="treeSplitter"
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

          {/** エディタ */}
          {editor &&
            <div id="editorWrapper" style={{ width: (width - 4) + 'px' }}>

              {/** テキスト用のメニュー */}
              <Container id="editorMenu">
                <Container className="buttonBarLeft">

                  {/** 強調 */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="bold" sx={{ mr: 2 }} onClick={(e) => handleInsert("**", "**")} className="editorBtn">
                    <FormatBoldIcon fontSize="small" />
                  </IconButton>

                  {/** イタリック */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="italic" sx={{ mr: 2 }} onClick={(e) => handleInsert("*", "*")} className="editorBtn">
                    <FormatItalicIcon fontSize="small" />
                  </IconButton>

                  {/** 打ち消し線 */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="strike" sx={{ mr: 2 }} onClick={(e) => handleInsert("~~", "~~")} className="editorBtn">
                    <FormatStrikethroughIcon fontSize="small" />
                  </IconButton>

                  {/** コードブロック */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="code" sx={{ mr: 2 }} onClick={(e) => handleInsert("\n```\n", "\n```\n")} className="editorBtn">
                    <CodeIcon fontSize="small" />
                  </IconButton>

                  {/** 引用 */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="code" sx={{ mr: 2 }} onClick={(e) => handleInsert("> ")} className="editorBtn">
                    <FormatQuoteIcon fontSize="small" />
                  </IconButton>

                  {/** 区切り */}
                  <Divider style={{ width: "10px", display: "inline-flex" }} orientation="vertical" flexItem alignItems="center" />

                  {/** スニペット挿入 */}
                  {snippetList.length > 0 && (<>
                    <IconButton size="small" edge="start" color="inherit" aria-label="snippet" sx={{ mr: 2 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => setSnippetAnchor(e.currentTarget)}
                      className="editorBtn">
                      <PlaylistAddIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={snippetAnchor}
                      open={Boolean(snippetAnchor)}
                      onClose={() => setSnippetAnchor(null)}
                      disableAutoFocus
                      disableEnforceFocus
                      disableRestoreFocus
                      PaperProps={{ sx: { backgroundColor: '#2a2a2a', color: '#f1f1f1', border: '1px solid #444' } }}
                    >
                      {snippetList.map((s) => (
                        <MenuItem key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertSnippet(s.body)}
                          sx={{ fontSize: '13px', '&:hover': { backgroundColor: '#3a3a3a' } }}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>)}

                </Container>

                <Container className="buttonBarRight">

                  {/** フォント設定 */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="font" sx={{ mr: 2 }} onClick={handleFontDialog} className="editorBtn">
                    <FontDownloadIcon fontSize="small" />
                  </IconButton>

                  {/** プログラム起動 */}
                  <IconButton size="small" edge="start" color="inherit" aria-label="process" sx={{ mr: 2 }} onClick={handleRunEditor} className="editorBtn">
                    <LaunchIcon fontSize="small" />
                  </IconButton>

                  {/** テンプレートプレビューリフレッシュ */}
                  {mode === Mode.template &&
                    <IconButton size="small" edge="start" color="inherit" aria-label="preview" sx={{ mr: 2 }}
                      onClick={() => {
                        if (!previewNoteId || !previewOtherTemplateId || !templateType) return;
                        runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
                          .then((result) => setHTML(result))
                          .catch((err) => evt.showErrorMessage(err));
                      }}
                      className="editorBtn">
                      <PreviewIcon fontSize="small" />
                    </IconButton>
                  }

                </Container>
              </Container>

              {/** テキスト編集（行番号ガター + textarea） */}
              <div className="editorArea">
                <div className="editorLineNumbers" ref={lineNumbersRef}
                  style={editorStyle}>
                  {text.split('\n').map((_, i) => {
                    const wraps = lineHeights[i] || 1;
                    return (
                      <div key={i} className="editorLineNumber" style={{ height: `${wraps * 1.5}em` }}>
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
                <textarea id="editor" style={editorStyle}
                  value={text}
                  onKeyDown={(e) => handleKeyDown(e)} onChange={handleChangeText}
                  onDragOver={handleDragOver} onDrop={handleDrop}
                  onScroll={handleEditorScroll} />
              </div>

              {/** 左側の操作用位置 */}
              <Toolbar className="buttonBar">
                <Container className="buttonBarLeft">
                  {/** コミットコメント */}
                  <TextField value={comment} onChange={(e) => setComment(e.target.value)}
                    size="small"
                    variant="outlined"
                    style={{ marginLeft: "0px", paddingLeft: "0px" }}
                    inputProps={{ style: commentStyle }}
                    InputProps={{ endAdornment: commitIcon }}
                  ></TextField>
                </Container>
              </Toolbar>
            </div>
          }

          {/** セパレータ（エディタ/ビューア間） */}
          {editor && viewer &&
            <div ref={splitterRef} id="splitter"
              onPointerDown={handleSplitterPointerDown}
              onPointerMove={handleSplitterPointerMove}
              onPointerUp={handleSplitterPointerUp}
            />
          }

          {/** 表示側 */}
          {viewer &&
            <div id="dataViewer">

              {/** 表示するコンポーネントを変更 */}
              {(mode === Mode.note) &&
                <HTMLFrame html={html} />
              }
              {mode === Mode.diagram &&
                <div id="mermaidViewer"></div>
              }
              {mode === Mode.template && (() => {
                const previewOtherTemplates = templateType === "layout" ? previewContents : previewLayouts;
                return (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px", borderBottom: "1px solid #333", flexShrink: 0 }}>
                      <Select
                        value={previewOtherTemplateId}
                        onChange={(e) => setPreviewOtherTemplateId(e.target.value)}
                        size="small"
                        displayEmpty
                        sx={{ minWidth: 120, fontSize: "0.78rem", color: "#f1f1f1", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
                      >
                        {previewOtherTemplates.map((t) => (
                          <MenuItem key={t.id} value={t.id} sx={{ fontSize: "0.8rem" }}>{t.name}</MenuItem>
                        ))}
                      </Select>
                      <Select
                        value={previewNoteId}
                        onChange={(e) => setPreviewNoteId(e.target.value)}
                        size="small"
                        displayEmpty
                        sx={{ minWidth: 120, fontSize: "0.78rem", color: "#f1f1f1", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
                      >
                        {previewNotes.map((n) => (
                          <MenuItem key={n.id} value={n.id} sx={{ fontSize: "0.8rem" }}>{n.name}</MenuItem>
                        ))}
                      </Select>
                    </div>
                    <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                      <HTMLFrame html={html} />
                    </div>
                  </div>
                );
              })()}

              {/** フローティング操作ボタン（右下: 公開 / ダイアグラムダウンロード） */}
              {mode !== Mode.template &&
                <IconButton className="floatPublishBtn" size="small" aria-label="publish" onClick={handlePublish}>
                  <PublishIcon fontSize="small" style={{ color: "#f1f1f1" }} />
                </IconButton>
              }
              {mode === Mode.diagram &&
                <IconButton className="floatPublishBtn" size="small" aria-label="download" onClick={handleDownload} sx={{ bottom: '64px' }}>
                  <DownloadIcon fontSize="small" style={{ color: "#f1f1f1" }} />
                </IconButton>
              }

              {/** フローティング操作ボタン（左下: 非公開） */}
              {mode !== Mode.template &&
                <IconButton className="floatUnpublishBtn" size="small" aria-label="unpublish" onClick={handleUnpublish}>
                  <UnpublishedIcon fontSize="small" style={{ color: "#f1f1f1" }} />
                </IconButton>
              }

            </div>
          }

        </div>

      </Paper>

      {/** フォント設定 */}
      <FontDialog show={fontDialog} font={editorFont} onClose={handleFontDialogClose} />
    </>
  );
}

export default Editor;
