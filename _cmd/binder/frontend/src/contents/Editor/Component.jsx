import { useState, useEffect, useContext } from "react"
import { useParams } from "react-router";

import { Container, IconButton, Paper, TextField, Toolbar ,InputAdornment} from "@mui/material";

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../../wailsjs/go/api/App.js";
import { GetDiagram, OpenDiagram, SaveDiagram } from "../../../wailsjs/go/api/App.js";
import { GetTemplate,OpenTemplate, SaveTemplate} from "../../../wailsjs/go/api/App.js";
import { GetAsset,Generate,Commit } from "../../../wailsjs/go/api/App.js";
import { RunEditor } from "../../../wailsjs/go/api/App.js";

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";

import Event, {EventContext} from "../../Event.jsx";

import HTMLFrame from "./HTMLFrame.jsx";
import '../../assets/Editor.css'
import { Mode } from "../../App.jsx";

import CommitIcon from '@mui/icons-material/Commit';
import DownloadIcon from '@mui/icons-material/Download';
import PublishIcon from '@mui/icons-material/Publish';

import LaunchIcon from '@mui/icons-material/Launch';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FontDialog from "../FontDialog.jsx";

/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 * TODO : 表示ビューをフローティングにすることを可能にする？
 */
function Editor(props) {

  var {mode,id} = useParams();
  const evt = useContext(EventContext)

  const [editor, setEditor] = useState(true);
  const [viewer, setViewer] = useState(true);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  const [width, setWidth] = useState(500);
  const [menuWidth, setMenuWidth] = useState(310);
  const [fontDialog, setShowFontDialog] = useState(false);
  const [editorStyle, setEditorStyle] = useState({});

  //viewHTMLのprop
  const [html, setHTML] = useState("");
  //更新状態のアイコン
  const [updated, setUpdated] = useState(false);

  //テキストにセンタリング用のタグを埋め込む
  const insertCenterTag = (txt) => {
    if ( txt === "" ) {
      return txt;
    }

    var len = txt.length;
    var e = document.querySelector("#editor");
    var pos = e.selectionStart;

    const lines = txt.split(/\n/,-1);

    var now = 0;
    var start = false;
    var b = false;

    for ( const line of lines ) {
      now += line.length + 1;

      if ( line.indexOf("```") === 0 ) {
        if ( start ) {
          start = false;
        } else {
          start = true;
        }
      }

      if ( now > pos ) {
        b = true;
      }

      if ( b && !start && line === "" ) {
        pos = now;
        break;
      }
    }

    var before   = txt.substr(0, pos);
    var after    = txt.substr(pos, len);
    var tag = '\n\n<div id="binder_focus_id"></div>\n\n';
    return before + tag + after;
  }

  //開いた時の初期処理
  useEffect(() => {

    evt.clearMessage();

    if ( mode === Mode.diagram ) {

      setEditor(true);
      setViewer(true);

      OpenDiagram(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

      GetDiagram(id).then((resp) => {
        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        //console.log(resp.publishStatus);

        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if (mode === Mode.note ) {

      setEditor(true);
      setViewer(true);

      OpenNote(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      GetNote(id).then((resp) => {
        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    } else if ( mode === Mode.template ) {

      setEditor(true);
      setViewer(false);

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
        setText(resp);
        //指定ノートだった場合、最新ノートから値を取得してきて埋め込む
        //TODO: HTML をどのように作成するかを考える 
        //createNoteElement();
      }).catch((err) => {
        evt.showErrorMessage(err);
      });

      GetTemplate(id).then((resp) => {
        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }

        setName(resp.name);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    } else if ( mode === "assets" ) {
      // assets に合わせる

      GetAsset(id).then((resp) => {

        setEditor(!resp.binary);
        setViewer(resp.binary);

        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setName(resp.name);

        if (!resp.binary) {
          //アセットを開く
        }
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    }

  }, [id]);

  //名称が変更になった場合の処理
  useEffect(() => {
    evt.changeTitle(name)
    setComment("Updated: " + name);
  }, [name]);

  const parseText = async () => {
    if ( text === "" ) {
      return;
    }

    if ( mode === Mode.diagram ) {
      viewDiagram(text);
    } else if ( mode === Mode.note ) {
      //公開時にここが入らないようにする
      viewHTML(insertCenterTag(text));
    } else if ( mode === Mode.template ) {
      //viewHTML(text, noteElm);
    } else {
      //初回時の実行があるか
    }
  }

  //テキスト変更時の処理
  useEffect(() => {
    parseText();
  }, [text]);

  //データをマークダウンからHTMLに変換
  const createMarked = async (id, txt, local) => {
    var p = ""
    await ParseNote(id,local,txt).then((resp) => {
      p = resp;
    }).catch((err) => {
      evt.showErrorMessage(err);
      p = txt;
    });

    var val = await Marked.parse(p);
    if ( val ) {
      return val;
    }
    //return marked.marked(p);
    return "";
  }

  /**
   * HTMLの表示
   * @param {*} txt 
   * @param {*} embNoteElm 
   */
  const viewHTML = async (txt, embNoteElm) => {

    if (mode === "note") {

      var embed = await createMarked(id,txt,true);
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
   * @param {*} txt 
   */
  const viewDiagram = async (txt) => {

    Mermaid.parse(txt).then( (data) => {

      var elm = document.querySelector('#mermaidViewer');
      elm.innerHTML = data.svg;

      var svg = document.querySelector('#mermaidViewer svg');
      var left = 0;
      var top = 0;
      var scale = 1.0;

      var transform = function()  {
        var px = left + 'px';
        var py = top + 'px';
        svg.style.transform = `translate(${px},${py}) scale(${scale})`;
      }

      //ドラッグ
      svg.addEventListener("pointermove",function( event ) {
        if ( !event.buttons ) {
          return;
        }
        left = (left + event.movementX);
        top = (top + event.movementY);
        transform();
      });

      //Wheelによる拡大
      svg.addEventListener("wheel", function( event ) {
        var dy = event.deltaY;
        var s = 0.1;
        if ( dy > 0 ) {
          s *= -1;
        }
        scale += s;
        transform();
      });

      transform();

    }).catch((err) => {
      //console.log(txt)
      evt.showWarningMessage("Diagram parse error:" + err);
    });
  }

  var startX;
  const dragSplitter = (e) => {
    var t = e.type;
    if (t === "dragstart") {
      startX = e.screenX;
    } else if (t === "dragend") {
      var w = width - (startX - e.screenX );
      setWidth(w);
    }
  }

  /**
   * テキストの変更
   * @param {*} txt 
   */
  const changeText = (txt) => {

    setUpdated(true);
    setText(txt);
    if ( mode === Mode.note ) {
      SaveNote(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    } else if ( mode === Mode.diagram ) {
      SaveDiagram(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    } else if ( mode === Mode.template ) {
      SaveTemplate(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    }
  }

  //出力処理
  const handlePublish = async () => {
    var elm = "";
    if ( mode === Mode.note ) {
      elm = await createMarked(id,text,false);
    } else if (mode === Mode.diagram ) {
      var obj = await Mermaid.parse(text);
      elm = obj.svg
    } else if (mode === Mode.template ) {
      elm = text;
    } else if (mode === Mode.asset ) {
      elm = text;
    }

    //出力処理を行う
    Generate(mode,id,elm).then(() => {
      evt.showSuccessMessage("Generate.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //個別コミットを行う
  const handleCommit = () => {
    Commit(mode,id,comment).then(() => {
      setUpdated(false);
      evt.showSuccessMessage("Commit.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  //SVG のダウンロードを行う
  const handleDownload = async () => {
      var elm = document.querySelector('#mermaidViewer');
      var data = new Blob([elm.innerHTML], {type: 'image/svg+xml'});
      var dataURL = window.URL.createObjectURL(data);
      var tempLink = document.createElement('a');
      tempLink.href = dataURL;
      tempLink.setAttribute('download', name + '.svg');
      tempLink.click();
  }

  /**
   * 文字列挿入
   * @param {*} s 
   * @param {*} e 
   */
  const handleInsert = (s,e) => {
    var textarea = document.querySelector("#editor");
    const val = textarea.value;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const before = val.substring(0,start)
    const text = val.substring(start,end)
    const after = val.substring(end)

    textarea.value =  before + s + text + e + after;

    setTimeout(function() {
      setText(textarea.value);
    },500)

  }

  /**
   * Enter時にインデントを挿入
   * @param {*} e 
   * @returns 
   */
  const handleKeyDown = (e) => {
    if (e.key !== "Enter" ) {
      return;
    }
    
    e.preventDefault();
    const textarea = e.target;
    const val = textarea.value;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const before = val.substring(0,start)
    const after = val.substring(end)

    var indent = "";
    var char = "";
    //文字列の前方の状態を確認
    const last = before.lastIndexOf('\n')
    if ( last !== -1 ) {
      const line = before.substring(last+1);
      for ( let idx = 0; idx < line.length; ++idx ) {
        var c = line[idx]
        if ( c !== " " ) {
          if ( c === "-" ) {
            char = "- ";
          } else if ( c === ">" ) {
            char = "> ";
          } else if ( c === "1" ) {
            var c2 = line[idx + 1];
            if ( c2 === "." ) {
              char = "1. ";
            }
          }
          break;
        }
        indent += " ";
      }
    }

    var at = "\n" + indent + char;

    textarea.value =  before + at + after;
    textarea.selectionStart = start + at.length;
    textarea.selectionEnd = start + at.length;

    setTimeout(function() {
      setText(textarea.value);
    },500)
  }

  /**
   * エディタを起動
   */
  const handleRunEditor = () => {

    //TODO 画面抑制を開始

    //ファイルを監視
    const sec = 2;
    var interval = setInterval(function() {
      // ファイルの内容を取得
    },1000 * sec)

    RunEditor(mode,id).then( () => {
      clearInterval(interval)
    }).catch( (err) => {
      evt.showErrorMessage(err);
      clearInterval(interval)
    }).finally( () => {
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
   * @param {*} change 
   */
  const handleFontDialogClose = (change) => {
    setShowFontDialog(false);
  }

  /**
   * 初回起動のみのエフェクト
   */
  useEffect(() => {
    //メニューを開いているかのイベント
    evt.register("Editor",Event.ShowMenu,function(flag) {
      if ( flag ) {
        setMenuWidth(310);
      } else {
        setMenuWidth(0);
      }
    });

    //設定を取得

    var style = {};
    style.fontSize = "20px";
    style.color = "#eeeeee";
    style.fontFamily = "Calex Code JP Regular";
    setEditorStyle(style);

  },[]);


  var splitterW = 10;
  {/** スプリッター部分をコンポーネント化するか？ */ }
  var editWrapperStyle = {};
  editWrapperStyle.width = (width) + "px";

  var splitterStyle = {};
  splitterStyle.left = (menuWidth + width - 3) + "px";
  var viewerStyle = {};
  viewerStyle.left = (menuWidth + width + splitterW) + "px";

  var commentStyle = {};
  commentStyle.fontSize = "12px";
  commentStyle.paddingTop = "12px";
  commentStyle.width = (width - 98) + "px";

  var color = "#f1f1f1";
  if ( updated ) {
    color = "#cf540c";
  }

  //コミット用のアイコン(コメント欄の横)
  const commitIcon = (
    <InputAdornment position="end" className="linkBtn"> 
      <CommitIcon fontSize="small" style={{ color: color }}  onClick={handleCommit}> </CommitIcon> 
    </InputAdornment>
  )

  {/** 表示するものをビュワーに渡す段階で、表示用のものに変更する 
      * 表示処理を行わないっていう選択肢
      */}
  return (
    <>

      {/** エディタ */}
      <Paper id="splitScreen">

{/** エディタ */}
{editor && 
        <div id="editorWrapper" style={editWrapperStyle}>

          {/** テキスト用のメニュー */}
          <Container id="editorMenu">
              <Container className="buttonBarLeft">

                {/** 強調 */}
                <IconButton size="small" edge="start" color="inherit" aria-label="bold" sx={{ mr: 2 }} onClick={(e) => handleInsert("**","**")} className="editorBtn">
                  <FormatBoldIcon fontSize="small" />
                </IconButton>

                {/** イタリック */}
                <IconButton size="small" edge="start" color="inherit" aria-label="italic" sx={{ mr: 2 }} onClick={(e) => handleInsert("*","*")} className="editorBtn">
                  <FormatItalicIcon fontSize="small" />
                </IconButton>

                {/** 打ち消し線 */}
                <IconButton size="small" edge="start" color="inherit" aria-label="strike" sx={{ mr: 2 }} onClick={(e) => handleInsert("~~","~~")} className="editorBtn">
                  <FormatStrikethroughIcon fontSize="small" />
                </IconButton>

                {/** コードブロック */}
                <IconButton size="small" edge="start" color="inherit" aria-label="code" sx={{ mr: 2 }} onClick={(e) => handleInsert("\n```\n","\n```\n")} className="editorBtn">
                  <CodeIcon fontSize="small" />
                </IconButton>

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

              </Container>
          </Container>

          {/** テキスト編集 */}
          <textarea id="editor" style={editorStyle} 
                                value={text} 
                                onKeyDown={(e) => handleKeyDown(e)} 
                                onChange={(e) => changeText(e.target.value)} />

          {/** 左側の操作用位置 */}
          <Toolbar className="buttonBar">
            <Container className="buttonBarLeft">
              {/** コミットコメント */}
              <TextField value={comment} onChange={(e) => setComment(e.target.value)}
                         size="small"
                         variant="outlined"
                         style={{marginLeft:"0px",paddingLeft:"0px"}}
                         inputProps={{style:commentStyle}}
                         InputProps={{endAdornment:commitIcon}}

                ></TextField>
            </Container>
          </Toolbar>
        </div>
}

{/** セパレータ */}
{editor && viewer && 
        <div draggable="true" id="splitter" style={splitterStyle} onDragStart={dragSplitter} onDragEnd={dragSplitter} onDrag={dragSplitter}></div>
}

{/** 表示側 */}
{viewer && 
<>
        {/** 表示するコンポーネントを変更 */}
        <div id="dataViewer" style={viewerStyle}>

          {( mode === Mode.note ) &&
            <HTMLFrame html={html}/>
          }
          {mode === Mode.diagram &&
            <div id="mermaidViewer"></div>
          }

          {/** 右側の操作用位置 */}
          <Toolbar className="buttonBar">
            <Container className="buttonBarLeft">

{mode !== Mode.template &&
<>
              {/** 公開位置への転送 */}
              <IconButton className="buttonBarRightButton" size="small" edge="start" color="inherit" aria-label="publish" sx={{ mr: 2 }} onClick={handlePublish}>
                <PublishIcon fontSize="small" style={{ color: "#f1f1f1" }} />
              </IconButton>
</>
}

            </Container>

            <Container className="buttonBarRight">
{mode === Mode.diagram &&
<>
              {/** 表示しているSVGのダウンロード */}
              <IconButton className="buttonBarRightButton" size="small" edge="start" color="inherit" aria-label="download" sx={{ mr: 2 }} onClick={handleDownload}>
                <DownloadIcon fontSize="small" style={{ color: "#f1f1f1" }} />
              </IconButton>
</>
}
            </Container>

          </Toolbar>

        </div>
</>
}
      </Paper>

      {/** フォント設定 */}
      <FontDialog show={fontDialog} onClose={handleFontDialogClose}/>
    </>
  );
}

export default Editor;