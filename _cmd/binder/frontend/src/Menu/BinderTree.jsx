import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Menu, MenuItem } from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';

import WebAssetIcon from '@mui/icons-material/WebAsset';
import NoteIcon from '@mui/icons-material/Note';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import HtmlIcon from '@mui/icons-material/Html';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import AttachmentIcon from '@mui/icons-material/Attachment';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { copyClipboard } from '../App';

import { OpenBinderSite, GetTree } from '../../wailsjs/go/api/App';

import Event from '../Event';

/**
 * Mermaid アイコン
 * @param {*} props 
 * @returns 
 */
function MermaidSVG(props) {
  return (<>
  <svg width={props.width} height={props.height} viewBox="0 0 491 491">
    <path d="M490.16,84.61C490.16,37.912 452.248,0 405.55,0L84.61,0C37.912,0 0,37.912 0,84.61L0,405.55C0,452.248 37.912,490.16 84.61,490.16L405.55,490.16C452.248,490.16 490.16,452.248 490.16,405.55L490.16,84.61Z" 
          fill={props.fill}/>
    <path d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z" 
          />
  </svg>
  </>);
}

function MermaidIcon() {
  return <MermaidSVG width="24" height="24" fill="white" contents="black" />
}

{/** バインダーのツリー */ }
function BinderTree(props) {

  const nav = useNavigate();

  //ツリーデータ
  const [tree, setTree] = useState([]);
  //選択しているID
  const [id, setId] = useState(props.id);
  //選択しているオブジェクトの親ID
  const [parentId, setParentId] = useState(props.parentId);

  //リソースを作成
  const viewTree = () => {
    GetTree().then((resp) => {
      setTree(resp.data);
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
  }

  useEffect(() => {
    viewTree();
  }, [props.redraw])

  const [selected,setSelected] = useState([props.id]);
  const [expand,setExpand] = useState([props.id]);

  const [noteEl, setNoteEl] = useState(null);
  const noteMenu = Boolean(noteEl);
  const [diagramEl, setDiagramEl] = useState(null);
  const diagramMenu = Boolean(diagramEl);

  //メニュー表示
  const showMenu = (e,call) => {
    e.preventDefault();
    call(e.target);
    e.stopPropagation();
  }

  //メニューを閉じる
  const closeMenu = (call) => {
    setId(undefined);
    call(null);
  };

  const toggleList = (src,id) => {
    var ex = false;
    var list = [];
    src.map( (v) => {
      if ( v !== id ) {
        list.push(v);
      } else {
        ex = true;
      }
    });
    if ( !ex ) {
      list.push(id);
    }
    return list;
  }

  const expanded = (selectId) => {
    //すでに選択していた場合
    if ( id === selectId ) {
      var wk = toggleList(expand,selectId);
      setExpand(wk);
    }
  }

  const setCurrentId = (id,parentId) => {
    setId(id);
    setParentId(parentId);
    setSelected([id]);
  }


  //ノート作成
  const handleRegisterNote = (e,call) => {
    e.preventDefault();
    props.onChangeMode("note","",id);
    closeMenu(call);
  }

  //ノート編集
  const handleEditNote = (e,call) => {
    e.preventDefault();
    props.onChangeMode("note",id,parentId);
    closeMenu(call);
  }

  //ノートを開く処理
  const handleNoteOpen = (e, id, parentId) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentId(id,parentId);
    nav("/editor/note/" + id);
  }

  //ダイアグラム作成
  const handleRegisterDiagram = (e,call) => {
    e.preventDefault();
    props.onChangeMode("diagram", "", id);
    closeMenu(call);
  }

  //ダイアグラム編集
  const handleEditDiagram = (e,call) => {
    e.preventDefault();
    props.onChangeMode("diagram",id,parentId);
    closeMenu(call);
  }

  //ダイアグラム開く
  const handleDiagramOpen = (e, id, parentId) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentId(id,parentId);
    nav("/editor/diagram/" + id);
  }

  const OpenSite = () => {
    OpenBinderSite().then(() => {
    }).catch((err) => {
      console.warn(err);
    });
  }

  const onlyDiagram = (list) => {
    var only = true;
    list.forEach( (v) => {
      if ( v.type !== "diagram" ) {
        only = false;
      }
    })
    return only;
  }

  //ツリー描画　
  const getTreeItemsFromData = leafs => {

    if ( leafs === null ) {
      //return <></>;
    }

    return leafs.map(leaf => {

      let children = [];
      if ( leaf.children && leaf.children.length > 0) {
        children = getTreeItemsFromData(leaf.children);
      }

      var icon = <TextSnippetIcon />;
      var caller = setNoteEl;
      var evFunc = handleNoteOpen;

      if ( leaf.type === "diagram" ) {
        caller = setDiagramEl;
        evFunc = handleDiagramOpen;
        icon = <MermaidIcon />
      } else if ( children && children.length > 0 ) {
        if ( onlyDiagram(leaf.children) ) {
          icon = <LibraryBooksIcon />
        } else {
          icon = <FolderIcon />
        }
      }

      console.debug(leaf);
      return (
        <TreeItem key={leaf.id} nodeId={leaf.id}
                  label={leaf.name} icon={icon}
                  selected={selected}
                  onDoubleClick={(e) => expanded(leaf.id)}
                  onClick={(e) => evFunc(e,leaf.id,leaf.parentId)}
                  onContextMenu={(e) => showMenu(e,caller)}
                  children={children} />
      );
    });
  };

  return (<>

    {/** ツリーの表示 */}
    <TreeView className='treeText'
              defaultSelected={""}
              expanded={expand}
              aria-label="binder system navigator">
      {getTreeItemsFromData(tree)}
    </TreeView>

    {/** 以下ツリー用のメニュ－ */}
    {/** ノートメニュー 
      編集 -> IDの変更、ノート削除
      アセットの追加
      データテキストの追加
      */}
    <Menu anchorEl={noteEl}
      open={noteMenu}
      onClose={() => closeMenu(setNoteEl)}>
      <MenuItem onClick={(e) => handleEditNote(e,setNoteEl)}>Edit</MenuItem>
      <MenuItem onClick={(e) => handleRegisterNote(e,setNoteEl)}>Add Note</MenuItem>
      <MenuItem onClick={(e) => handleRegisterDiagram(e,setNoteEl)}>Add Diagram</MenuItem>
    </Menu>

    {/** ダイアグラムメニュー 
      編集 -> IDの変更 削除 (アセットの場合、変更？)
      */}
    <Menu anchorEl={diagramEl}
      open={diagramMenu}
      onClose={() => closeMenu(setDiagramEl)}>
      <MenuItem onClick={(e) => handleEditDiagram(e,setDiagramEl)}>Edit</MenuItem>
    </Menu>

    {/** テンプレートのメニューはなし？ */}
  </>);
}
export default BinderTree;