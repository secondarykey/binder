import { useState, useEffect } from "react"
import { Container, IconButton, Paper, TextField, Toolbar ,InputAdornment} from "@mui/material";

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../wailsjs/go/api/App.js";
import { GetDiagram, OpenDiagram, SaveDiagram } from "../../wailsjs/go/api/App.js";
import { GetTemplate,OpenTemplate, SaveTemplate} from "../../wailsjs/go/api/App.js";
import { Generate,Commit } from "../../wailsjs/go/api/App.js";
import CommitIcon from '@mui/icons-material/Commit';
import DownloadIcon from '@mui/icons-material/Download';
import HTMLFrame from "../components/HTMLFrame.jsx";
import PublishIcon from '@mui/icons-material/Publish';

import Marked from "../components/Marked";
import Event from "../Event.jsx";
import Message from '../Message';

import { useParams } from "react-router-dom";
import Mermaid from "../components/Mermaid";

import '../assets/vim.min.js';
import '../assets/Editor.css'
/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 * TODO : 表示ビューをフローティングにすることを可能にする？
 */
function Editor(props) {

  var {mode,id} = useParams();

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  const [noteElm, setNoteElm] = useState("");
  const [width, setWidth] = useState(500);
  const [html, setHTML] = useState("");

  const [updated, setUpdated] = useState(false);

  //センタリング用のタグを埋め込む
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

    Message.clear();

    vim.open({
      debug: false,
      showMsg: function (msg) {
        alert('vim.js say:' + msg);
      }
    });

    if ( mode === "diagram" ) {

      OpenDiagram(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        Message.showError(err);
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
        Message.showError(err);
      })

    } else if (mode === "note") {

      OpenNote(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        Message.showError(err);
      });

      GetNote(id).then((resp) => {
        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }
        setName(resp.name);
      }).catch((err) => {
        Message.showError(err);
      })

    } else if (mode === "template") {

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
        setText(resp);
        //指定ノートだった場合、最新ノートから値を取得してきて埋め込む
        //TODO: HTML をどのように作成するかを考える 
        //createNoteElement();
      }).catch((err) => {
        Message.showError(err);
      });

      GetTemplate(id).then((resp) => {
        if ( resp.updatedStatus > 0 ) {
          setUpdated(true);
        } else {
          setUpdated(false);
        }

        setName(resp.name);
      }).catch((err) => {
        Message.showError(err);
      })
    }

  }, [id]);

  //名称が変更になった場合の処理
  useEffect(() => {
    Event.changeTitle(name)
    setComment("Updated: " + name);
  }, [name]);

  //テキスト変更時の処理
  useEffect(() => {
    if (mode === "diagram") {
      if ( text !== "" ) {
        viewDiagram(text);
      }
    } else if (mode === "note") {
      //公開時にここが入らないようにする
      viewHTML(insertCenterTag(text));
    } else if (mode === "template") {
      //viewHTML(text, noteElm);
    } else {
      //初回時の実行があるか
    }
  }, [text, noteElm]);

  //データをマークダウンからHTMLに変換
  const createMarked = async (id, txt, local) => {
    var p = ""
    await ParseNote(id,local,txt).then((resp) => {
      p = resp;
    }).catch((err) => {
      Message.showError(err);
      p = txt;
    });

    var val = await Marked.parse(p);
    if ( val ) {
      return val;
    }
    //return marked.marked(p);
    return "";
  }

  const viewHTML = async (txt, embNoteElm) => {

    if (mode === "note") {

      var embed = await createMarked(id,txt,true);
      CreateNoteHTML(id, embed).then((resp) => {
        setHTML(resp);
      }).catch((err) => {
        Message.showError(err);
      })

    } else if (mode === "template") {
      //CreateTemplateHTML(id, txt, embNoteElm).then((resp) => {
        //setHTML(resp);
      //}).catch((err) => {
        //Event.showError(err);
      //})
    }
  }

  const viewDiagram = (txt) => {

    Mermaid.parse(txt).then( (data) => {
      var elm = document.querySelector('#mermaidViewer');
      elm.innerHTML = data.svg;
    }).catch((err) => {
      console.log(txt)
      Message.showWarning("Diagram parse error:" + err);
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
    if (mode === "note") {
      SaveNote(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Message.showError(err);
      })
    } else if (mode === "diagram") {
      SaveDiagram(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Message.showError(err);
      })
    } else if (mode === "template") {
      SaveTemplate(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Message.showError(err);
      })
    }
  }

  //出力処理
  const handlePublish = async () => {

    var elm = "";
    if (mode === "note") {
      elm = await createMarked(id,text,false);
    } else if (mode === "diagram") {
      var obj = await Mermaid.parse(text);
      elm = obj.svg
    } else if (mode === "template") {
      elm = text;
    } else if (mode === "asset") {
      elm = text;
    }

    console.log(elm)
    //出力処理を行う
    Generate(mode,id,elm).then(() => {
      Message.showSuccess("Generate.")
    }).catch((err) => {
      Message.showError(err);
    })
  }

  //個別コミットを行う
  const handleCommit = () => {
    Commit(mode,id,comment).then(() => {
      setUpdated(false);
      Message.showSuccess("Commit.")
    }).catch((err) => {
      Message.showError(err);
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

  var editorStyle = {};
  editorStyle.fontSize = "20px";
  editorStyle.color = "#eeeeee";
  editorStyle.fontFamily = "Calex Code JP Regular";

  var menuWidth = 310;
  var splitterW = 10;

  {/** スプリッター部分をコンポーネント化するか？ */ }
  var editWrapperStyle = {};
  editWrapperStyle.width = width + "px";

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

  var commitIcon = (
    <InputAdornment position="end" className="linkBtn"> 
      <CommitIcon fontSize="small" style={{ color: color }}  onClick={handleCommit}> </CommitIcon> 
    </InputAdornment>
  )

  {/** 表示するものをビュワーに渡す段階で、表示用のものに変更する 
      * 表示処理を行わないっていう選択肢
      */}
  return (
    <>
      <Paper id="splitScreen">
        <div id="editorWrapper" style={editWrapperStyle}>
          {/** テキスト編集 */}
          <textarea id="editor" style={editorStyle} onChange={(e) => changeText(e.target.value)} value={text} />

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

        <div draggable="true" id="splitter" style={splitterStyle} onDragStart={dragSplitter} onDragEnd={dragSplitter} onDrag={dragSplitter}></div>

        {/** 表示するコンポーネントを変更 */}
        <div id="dataViewer" style={viewerStyle}>

          {(mode === "note" ) &&
            <HTMLFrame html={html}/>
          }
          {mode === "diagram" &&
            <div id="mermaidViewer"></div>
          }

          {/** 右側の操作用位置 */}
          <Toolbar className="buttonBar">
            <Container className="buttonBarLeft">

{mode !== "template" &&
<>
              {/** 公開位置への転送 */}
              <IconButton className="buttonBarRightButton" size="small" edge="start" color="inherit" aria-label="publish" sx={{ mr: 2 }} onClick={handlePublish}>
                <PublishIcon fontSize="small" style={{ color: "#f1f1f1" }} />
              </IconButton>
</>
}

            </Container>

            <Container className="buttonBarRight">
{mode === "diagram" &&
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

      </Paper>
    </>
  );
}

export default Editor;