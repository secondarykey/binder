import { useState, useEffect } from "react"
import { Container, IconButton, Paper, Toolbar } from "@mui/material";

import "../assets/mermaid.min.js";
import "../assets/marked.min.js";
import '../assets/vim.min.js';

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../wailsjs/go/api/App.js";
import { GetDiagram, OpenDiagram, SaveDiagram } from "../../wailsjs/go/api/App.js";
import { OpenTemplate, CreateTemplateHTML, SaveTemplate, Generate, Commit, GetLatestNoteId } from "../../wailsjs/go/api/App.js";
import OutputIcon from '@mui/icons-material/Output';
import CommitIcon from '@mui/icons-material/Commit';
import DownloadIcon from '@mui/icons-material/Download';
import HTMLFrame from "../components/HTMLFrame.jsx";

import Event from "../Event.jsx";
import { useParams } from "react-router-dom";

/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 * TODO : 表示ビューをフローティングにすることを可能にする？
 */
function Editor(props) {

  var {mode,id} = useParams();

  var downloadName = "";

  const [text, setText] = useState("");
  const [noteElm, setNoteElm] = useState("");
  const [width, setWidth] = useState(500);
  const [html, setHTML] = useState("");

  /**
   * コンテンツの
   * @param {*} id 
   * @param {*} resp 
   */
  const redrawNoteElm = async (id,resp) => {
    var elm = await createMarked(id,resp, true);
    setNoteElm(elm);
  }

  const changeTemplateName = (id) => {
    var ret = "Note";
    if (id === "layout") {
      ret = "Layout";
    } else if (id === "index") {
      ret = "Index";
    } else if (id === "list") {
      ret = "NoteList";
    }
    return ret;
  }

  const createNoteElement = async () => {
    var id = await getLatestNoteId();
    setTemplateNoteId(id);

    //最新のノートを取得
    OpenNote(id).then((resp) => {
      redrawNoteElm(id,resp)
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
  }

  const getTemplateNoteId = async () => {
    var id = "";
    await GetLatestNoteId().then((resp) => {
      id = resp;
    }).catch((err) => {
      Event.showErrorMessage(err);
    })
    return id;

  }

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
    var val = '\n<div id="binder_focus_id"></div>\n';
    return before + val + after;
  }

  //開いた時の初期処理
  useEffect(() => {

    Event.clearMessage();
    vim.open({
      debug: false,
      showMsg: function (msg) {
        alert('vim.js say:' + msg);
      }
    });

    if ( mode === "diagram" ) {

      mermaid.initialize({ startOnLoad: false });
      OpenDiagram(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        Event.showErrorMessage(err);
      })

      GetDiagram(id).then((resp) => {
        Event.changeTitle(resp.name)
        downloadName = resp.name;
      }).catch((err) => {
        Event.showErrorMessage(err);
      })

    } else if (mode === "note") {

      OpenNote(id).then((resp) => {
        setText(resp);
      }).catch((err) => {
        Event.showErrorMessage(err);
      });

      GetNote(id).then((resp) => {
        Event.changeTitle(resp.name)
      }).catch((err) => {
        Event.showErrorMessage(err);
      })

    } else if (m === "template") {

      //テンプレートを開く
      OpenTemplate(id).then((resp) => {
        setText(resp);
        //指定ノートだった場合、最新ノートから値を取得してきて埋め込む
        //TODO: HTML をどのように作成するかを考える 
        //createNoteElement();
      }).catch((err) => {
        Event.showErrorMessage(err);
      });

      //TODO テンプレートに名称が入るか？
      Event.changeTitle(resp.name)
    }

  }, [id]);

  //テキスト変更時の処理
  useEffect(() => {
    if (mode === "diagram") {
      viewDiagram(text);
    } else if (mode === "note") {
      viewHTML(insertCenterTag(text));
    } else if (mode === "template") {
      viewHTML(text, noteElm);
    } else {
      //初回時の実行があるか
    }
  }, [text, noteElm]);


  /*
  function reloadIFrame() {
    var elm = document.querySelector('#htmlViewer');
    elm.contentWindow.location.reload();
  }
  */

  //データをマークダウンからHTMLに変換
  const createMarked = async (id, txt, local) => {
    var p = ""
    await ParseNote(id,local,txt).then((resp) => {
      p = resp;
    }).catch((err) => {
      Event.showErrorMessage(err);
      p = txt;
    });
    return marked.marked(p);
  }

  const createMermaid = async (txt) => {
    var rtn = {};
    await mermaid.render('svg', txt).then((data) => {
      rtn = data.svg
    }).catch((err) => {
      rtn = err;
    });
    return rtn;
  }

  const viewHTML = async (txt, embNoteElm) => {

    var elm = document.querySelector('#htmlViewer');
    if (mode === "note") {

      var embed = await createMarked(id,txt,true);
      CreateNoteHTML(id, embed).then((resp) => {
        setHTML(resp);
      }).catch((err) => {
        Event.showErrorMessage(err);
      })

    } else if (mode === "template") {
      CreateTemplateHTML(id, txt, embNoteElm).then((resp) => {
        setHTML(resp);
      }).catch((err) => {
        Event.showErrorMessage(err);
      })
    }
  }

  const viewDiagram = (txt) => {
    mermaid.parse(txt).then((flag) => {
      var elm = document.querySelector('#mermaidViewer');
      mermaid.render('svg', txt).then((data) => {
        elm.innerHTML = data.svg;
      }).catch((err) => {
        Event.showWarning("Diagram render error:" + err);
      });
    }).catch((err) => {
      Event.showWarning("Diagram parse error:" + err);
    });
  }

  var startX;
  const dragSplitter = (e) => {
    var t = e.type;
    if (t === "dragstart") {
      startX = e.screenX;
    } else if (t === "dragend") {
      var w = width - (startX - e.screenX);
      setWidth(w);
    }
  }

  /**
   * テキストの変更
   * @param {*} txt 
   */
  const changeText = (txt) => {

    setText(txt);
    if (mode === "note") {
      SaveNote(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Event.showErrorMessage(err);
      })
    } else if (mode === "diagram") {
      SaveDiagram(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Event.showErrorMessage(err);
      })
    } else if (mode === "template") {
      SaveTemplate(id, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        Event.showErrorMessage(err);
      })
    }
  }

  //出力処理
  const handleOutput = async () => {

    var elm = "";
    if (mode === "note") {
      elm = await createMarked(id,text, false);
    } else if (mode === "diagram") {
      elm = await createMermaid(text);
    }
    //出力処理を行う
    Generate(mode,id,elm).then(() => {
      Event.showSuccess("Generate.")
    }).catch((err) => {
      Event.showErrorMessage(err);
    })
  }

  //コミットを行う
  const commit = () => {
    Commit(mode,id,false).then(() => {
      Event.showSuccess("Commit.")
    }).catch((err) => {
      Event.showErrorMessage(err);
    })
  }

  //SVG のダウンロードを行う
  const handleDownload = async () => {
      var elm = document.querySelector('#mermaidViewer');
      console.log(elm.innerHTML)

      var data = new Blob([elm.innerHTML], {type: 'image/svg+xml'});
      var dataURL = window.URL.createObjectURL(data);
      var tempLink = document.createElement('a');
      tempLink.href = dataURL;
      tempLink.setAttribute('download', downloadName + '.svg');
      tempLink.click();
  }

  var editorStyle = {};
  editorStyle.fontSize = "20px";
  editorStyle.color = "#eeeeee";
  editorStyle.fontFamily = "Calex Code JP Regular";

  var menuWidth = 0;
  menuWidth = 320;

  var splitterW = 10;
  {/** スプリッター部分をコンポーネント化するか？ */ }
  var editWrapperStyle = {};
  editWrapperStyle.width = width + "px";

  var splitterStyle = {};
  splitterStyle.left = (menuWidth + width) + "px";
  var viewerStyle = {};
  viewerStyle.left = (menuWidth + width + splitterW) + "px";

  {/** 表示するものをビュワーに渡す段階で、表示用のものに変更する 
      * 表示処理を行わないっていう選択肢
      */}
  return (
    <>
      <Paper id="splitScreen">
        {/** 基本的にテキストだからこれでもOKだけどイベント周り */}
        <div id="editorWrapper" style={editWrapperStyle}>
          <textarea id="editor" style={editorStyle} onChange={(e) => changeText(e.target.value)} value={text} />

          {/** 左側の操作用位置 */}
          <Toolbar className="buttonBar">
            <Container className="buttonBarLeft">
{/** テンプレート時はコミットはなし */}
{mode !== "template" &&
<>
              {/** コミット */}
              <IconButton size="small" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={commit}>
                <CommitIcon fontSize="small" style={{ color: "#f1f1f1" }} />
              </IconButton>
</>
}
            </Container>

            <Container className="buttonBarRight">
            </Container>
          </Toolbar>
        </div>

        <div draggable="true" id="splitter" style={splitterStyle} onDragStart={dragSplitter} onDragEnd={dragSplitter} onDrag={dragSplitter}></div>

        {/** 表示するコンポーネントを変更 */}
        <div id="dataViewer" style={viewerStyle}>
          {(mode === "note" || mode === "template") &&
          <>
            <HTMLFrame html={html}/>
          </>
          }
          {mode === "diagram" &&
            <div id="mermaidViewer"></div>
          }

          {/** 右側の操作用位置 */}
          <Toolbar className="buttonBar">

            <Container className="buttonBarLeft">

              {/** 公開位置への転送 */}
              <IconButton size="small" edge="start" color="inherit" aria-label="publish" sx={{ mr: 2 }} onClick={handleOutput}>
                <OutputIcon fontSize="small" style={{ color: "#f1f1f1" }} />
              </IconButton>

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