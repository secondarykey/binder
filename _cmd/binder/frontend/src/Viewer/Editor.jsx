import {useState,useEffect} from "react"
import { IconButton, Paper, Toolbar } from "@mui/material";
import "../assets/mermaid.min.js";
import "../assets/marked.min.js";
import { OpenTemplate,OpenData,SaveData,OpenNote, SaveNote,CreateNoteHTML,CreateTemplateHTML, SaveTemplate ,Generate} from "../../wailsjs/go/api/App.js";
import { Save } from "@mui/icons-material";
import OutputIcon from '@mui/icons-material/Output';

/**
 * テキストを編集する為のコンポーネント。基本的に分割した表示になる
 * スプリッターでコントロールを可能にする
 * TODO : 表示ビューをフローティングにすることを可能にする？
 * 
 */
function Editor(props) {

    const [text,setText] = useState("");
    const [noteElm,setNoteElm] = useState("");
    const [width,setWidth] = useState(500);
    const [mode,setMode] = useState("");

    useEffect(() => {

      var m = "data";
      if ( props.templateId !== undefined ) {
        m = "template";
      } else if ( props.dataId === undefined ) {
        m = "note";
      }

      if ( m === "data" ) {

        mermaid.initialize({startOnLoad:false});
        //default,neutral,dark,forest,base
        //mermaidAPI.initialize({
          //theme: 'dark',
        //});

        OpenData(props.dataId,props.noteId).then( (resp)=>{
          setText(resp);
          viewData(resp);
        }).catch( (err)=> {
          console.warn(err);
          props.onMessage("error",err);
        })

      } else if ( m === "note" ) {
        OpenNote(props.noteId).then( (resp) => {
          setText(resp);
          viewHTML(resp);
        }).catch( (err) => {
          props.onMessage("error",err);
        });

      } else if ( m === "template" ) {
        //テンプレートを開く
        OpenTemplate(props.templateId).then( (resp) => {
          setText(resp);
          viewHTML(resp,noteElm);
          //指定ノートだった場合、最新ノートから値を取得してきて埋め込む
          if ( props.templateId === "note" ) {
            OpenNote("").then( (resp) => {
              var embed = marked.marked(resp);
              setNoteElm(embed);
            }).catch ( (err) => {
              console.warn(err);
              props.onMessage("error",err);
            });
          }
        }).catch( (err) => {
          props.onMessage("error",err);
        });
      }

      setMode(m);

    },[props.noteId,props.dataId,props.templateId])

    var menuWidth = 320;
    var splitterW = 10;

    {/** スプリッター部分をコンポーネント化するか？ */}
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

    const createMarked = (txt) => {
        return marked.marked(txt);
    }

    const createMermaid= async(txt) => {
        var rtn = {};
        await mermaid.render('svg', txt).then((data) => {
          rtn = data.svg
        }).catch( (err) => {
          rtn = err;
        });
        return rtn;
    }

    const viewHTML = (txt,embNoteElm) => {
        var elm = document.querySelector('#htmlViewer');
        if ( mode === "note" ) {
          var embed = createMarked(txt);
          CreateNoteHTML(props.noteId,embed).then( (html) => {
            elm.srcdoc = html;
          }).catch( (err) => {
            console.warn(err)
            props.onMessage("error",err);
          })
        } else if ( mode === "template" ) {
          CreateTemplateHTML(props.templateId,txt,embNoteElm).then( (html) => {
            elm.srcdoc = html;
          }).catch( (err) => {
            console.warn(err)
            props.onMessage("error",err);
          })
        }
    }

    const viewData = (txt) => {
      mermaid.parse(txt).then( (flag) => {
        var elm = document.querySelector('#mermaidViewer');
        mermaid.render('svg', txt).then( (data) => {
          elm.innerHTML = data.svg;
        });
      }).catch( (err) => {
        console.warn(err)
        props.onMessage("error",err);
      });
    }

    const dragSplitter = (e) => {
      //typeでやる？
      //824
      //400
      if ( e.type === "dragend" ) {
        console.log(e)
        //TODO 計算が違う
        setWidth(e.clientX - 320);
      }
    }

    const changeText = (txt) => {

      setText(txt);
      if ( mode === "note" ) {
        viewHTML(txt)
        SaveNote(props.noteId,txt).then(() => {
          console.log("ok");
        }).catch( (err) => {
          console.warn(err)
          props.onMessage("error",err);
        })

      } else if ( mode === "data" ) {

        viewData(txt);
        SaveData(props.dataId,props.noteId,txt).then(() => {
          console.log("ok");
        }).catch( (err) => {
          console.warn(err)
          props.onMessage("error",err);
        })

      } else if ( mode === "template" ) {
        viewHTML(txt,noteElm);
        SaveTemplate(props.templateId,txt).then( ()=> {
          console.log("ok");
        }).catch( (err) => {
          console.warn(err)
          props.onMessage("error",err);
        })
      }
    }

    const handleOutput = async () => {
      var elm = "";
      if ( mode === "note" ) {
        elm = createMarked(text);
      } else if ( mode === "data" ) {
        elm = await createMermaid(text);
      } 

      Generate(props.noteId,props.dataId,elm).then( () => {
      }).catch( (err) => {
          console.warn(err)
          props.onMessage("error",err);
      })
      //template時はボタンを押せなくする？
    }

    var editorStyle = {};
    editorStyle.fontSize="20px";
    editorStyle.color="#eeeeee";
    editorStyle.fontFamily="Calex Code JP Regular";

    {/** 表示するものをビュワーに渡す段階で、表示用のものに変更する 
      * 表示処理を行わないっていう選択肢
      */}
    return (
    <>
    <Paper id="splitScreen">

      {/** 基本的にテキストだからこれでもOKだけどイベント周り */}
      <div id="editorWrapper" style={editWrapperStyle}>
        <textarea id="editor" style={editorStyle} onChange={(e) =>changeText(e.target.value)} value={text}/>
        <Toolbar style={{backgroundColor:"#222222",position:"absolute",left:"0",right:"0",bottom:"0px",minHeight:"48px",border:"0"}}>
          <IconButton size="small" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }}>
            <Save fontSize="small" style={{color:"#f1f1f1"}}/>
          </IconButton>
        </Toolbar>
      </div>

      <div draggable="true" id="splitter" style={splitterStyle} onDragStart={dragSplitter} onDragEnd={dragSplitter} onDrag={dragSplitter}></div>

      {/** 表示するコンポーネントを変更 */}
      <div id="dataViewer" style={viewerStyle}>
{ (mode === "note" || mode === "template") &&
        <iframe id="htmlViewer" style={{width:"100%"}}></iframe>
}
{ mode === "data" &&
        <div id="mermaidViewer"></div>
}

        <Toolbar style={{backgroundColor:"#222222",position:"absolute",left:"0",right:"0",bottom:"0px",minHeight:"48px",border:"0"}}>
          <IconButton size="small" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={handleOutput}>
            <OutputIcon fontSize="small" style={{color:"#f1f1f1"}} />
          </IconButton>
        </Toolbar>

      </div>

    </Paper>
    </>
    );
}

export default Editor;