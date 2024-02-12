import { useState, useEffect } from "react"
import { Container, IconButton, Paper, Toolbar } from "@mui/material";

import "../assets/mermaid.min.js";
import "../assets/marked.min.js";
import '../assets/vim.min.js';

import { GetNote, ParseNote, OpenNote, SaveNote, CreateNoteHTML } from "../../wailsjs/go/api/App.js";
import { GetData, OpenData, SaveData } from "../../wailsjs/go/api/App.js";
import { OpenTemplate, CreateTemplateHTML, SaveTemplate, Generate, Commit, GetLatestNoteId } from "../../wailsjs/go/api/App.js";
import OutputIcon from '@mui/icons-material/Output';
import CommitIcon from '@mui/icons-material/Commit';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 * TODO : 表示ビューをフローティングにすることを可能にする？
 * 
 */
function Editor(props) {

  var downloadName = "";

  const [text, setText] = useState("");
  const [noteElm, setNoteElm] = useState("");
  const [width, setWidth] = useState(500);
  const [mode, setMode] = useState("");
  const [templateNoteId, setTemplateNoteId] = useState("");

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
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  const getLatestNoteId = async () => {
    var id = "";
    await GetLatestNoteId().then((resp) => {
      id = resp;
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    })
    return id;
  }

  //開いた時の初期処理
  useEffect(() => {

    props.onMessage("clear");

    vim.open({
      debug: false,
      showMsg: function (msg) {
        alert('vim.js say:' + msg);
      }
    });

    var m = "data";
    if (props.templateId !== undefined) {
      m = "template";
    } else if (props.dataId === undefined) {
      m = "note";
    }

    if (m === "data") {
      mermaid.initialize({ startOnLoad: false });
      OpenData(props.dataId, props.noteId).then((resp) => {
        setText(resp);
      }).catch((err) => {
        console.warn(err);
        props.onMessage("error", err);
      })

      GetData(props.dataId, props.noteId).then((resp) => {
        props.onChangeTitle(resp.name)
        downloadName = resp.name;
      }).catch((err) => {
        console.warn(err);
        props.onMessage("error", err);
      })

    } else if (m === "note") {

      OpenNote(props.noteId).then((resp) => {
        setText(resp);
      }).catch((err) => {
        props.onMessage("error", err);
      });

      GetNote(props.noteId).then((resp) => {
        props.onChangeTitle(resp.name)
      }).catch((err) => {
        console.warn(err);
        props.onMessage("error", err);
      })

    } else if (m === "template") {

      //テンプレートを開く
      OpenTemplate(props.templateId).then((resp) => {
        setText(resp);
        //指定ノートだった場合、最新ノートから値を取得してきて埋め込む
        if (props.templateId === "note" || props.templateId === "layout") {
          createNoteElement();
        }
      }).catch((err) => {
        props.onMessage("error", err);
      });

      props.onChangeTitle("Template:" + changeTemplateName(props.templateId))
    }
    setMode(m);

  }, [props.noteId, props.dataId, props.templateId])

  //テキスト変更時の処理
  useEffect(() => {
    if (mode === "data") {
      viewData(text);
    } else if (mode === "note") {
      viewHTML(text);
    } else if (mode === "template") {
      viewHTML(text, noteElm);
    } else {
      //初回時の実行があるか
    }
  }, [text, noteElm]);

  var menuWidth = 320;
  var splitterW = 10;

  {/** スプリッター部分をコンポーネント化するか？ */ }
  var editWrapperStyle = {};
  editWrapperStyle.width = width + "px";

  var splitterStyle = {};
  splitterStyle.left = (menuWidth + width) + "px";
  var viewerStyle = {};
  viewerStyle.left = (menuWidth + width + splitterW) + "px";

  function reloadIFrame() {
    //TODO UIで行う
    var elm = document.querySelector('#htmlViewer');
    elm.contentWindow.location.reload();
  }

  const createMarked = async (id, txt, local) => {
    var p = ""
    await ParseNote(id,local, txt).then((resp) => {
      p = resp;
    }).catch((err) => {
      props.onMessage("error", err);
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
      var embed = await createMarked(props.id,txt, true);
      CreateNoteHTML(props.noteId, embed).then((html) => {
        elm.srcdoc = html;
        //elm.scrollTo({ top: 400, behavior: "smooth" });
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      })
    } else if (mode === "template") {
      CreateTemplateHTML(props.templateId, templateNoteId, txt, embNoteElm).then((html) => {
        elm.srcdoc = html;
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      })
    }
  }

  const viewData = (txt) => {
    mermaid.parse(txt).then((flag) => {
      var elm = document.querySelector('#mermaidViewer');
      mermaid.render('svg', txt).then((data) => {
        elm.innerHTML = data.svg;
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      });
    }).catch((err) => {
      console.warn(err)
      props.onMessage("error", err);
    });
  }

  const dragSplitter = (e) => {
    //typeでやる？
    //824
    //400
    if (e.type === "dragend") {
      //TODO 計算が違う
      setWidth(e.clientX - 320);
    }
  }

  const changeText = (txt) => {

    setText(txt);
    if (mode === "note") {
      SaveNote(props.noteId, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      })
    } else if (mode === "data") {
      SaveData(props.dataId, props.noteId, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      })
    } else if (mode === "template") {
      SaveTemplate(props.templateId, txt).then(() => {
        console.debug("ok");
      }).catch((err) => {
        console.warn(err)
        props.onMessage("error", err);
      })
    }
  }

  const handleOutput = async () => {

    var elm = "";
    if (mode === "note") {
      elm = await createMarked(props.id,text, false);
    } else if (mode === "data") {
      elm = await createMermaid(text);
    }

    Generate(props.noteId, props.dataId, elm).then(() => {
      props.onMessage("success", "Generate");
    }).catch((err) => {
      console.warn(err)
      props.onMessage("error", err);
    })
  }

  const commit = () => {
    Commit(props.noteId, props.dataId, false).then(() => {
      props.onMessage("success", "commit");
    }).catch((err) => {
      console.warn(err)
      props.onMessage("error", err);
    })
  }

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
            <iframe id="htmlViewer" style={{ width: "100%" }}></iframe>
          }
          {mode === "data" &&
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
{mode === "data" &&
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