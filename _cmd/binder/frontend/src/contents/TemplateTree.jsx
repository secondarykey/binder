import { useState, useEffect,useContext } from 'react';
import { useNavigate } from 'react-router-dom';

import { Menu, MenuItem } from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';

import { GetTemplateTree } from '../../wailsjs/go/api/App';

import Event,{EventContext} from '../Event';

{/** バインダーのツリー */ }
function TemplateTree(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  //ツリーデータ
  const [tree, setTree] = useState([]);
  const [id,setId] = useState(undefined);

  const [selected,setSelected] = useState(["DIR_HTML"]);
  const [expand,setExpand] = useState(["DIR_HTML"]);

  //リソースを作成
  const viewTree = () => {
    GetTemplateTree().then((resp) => {
      setTree(resp.data);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  useEffect(() => {
    //再描画を追加しておく
    evt.register(Event.ReloadTree,() => {
      viewTree();
    })
    viewTree();
  }, [])

  const [dirEl, setDirEl] = useState(null);
  const dirMenu = Boolean(dirEl);
  const [templateEl, setTemplateEl] = useState(null);
  const templateMenu = Boolean(templateEl);

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

  const expanded = (e,selectId) => {
    e.preventDefault();
    //すでに選択していた場合
    if ( id === selectId ) {
      var wk = toggleList(expand,selectId);
      console.log("selectId:" + selectId)
      console.log("Extended:" + wk)
      setExpand(wk);
    }
  }

  const setCurrentId = (id) => {
    setId(id);
    setSelected([id]);
  }

  //テンプレート作成
  const handleRegisterTemplate = (e,call) => {
    closeMenu(call);
    nav("/template/register/" + id);
  }

  //テンプレート編集
  const handleEditTemplate = (e,call) => {
    closeMenu(call);
    nav("/template/edit/" + id);
  }

  //テンプレートを開く
  const handleTemplateOpen = (e, id) => {
    setCurrentId(id);
    nav("/editor/template/" + id);
  }

  //テンプレートを開く
  const handleSelectDir = (e, id) => {
    setCurrentId(id);
    nav("/template/view");
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
      var caller = setTemplateEl;
      var evFunc = handleTemplateOpen;

      //DIR指定は固定
      if ( leaf.id.indexOf("DIR_") === 0 ) {
        icon = <FolderIcon/>
        if ( leaf.id === "DIR_HTML") {
          caller = function(e){};
          evFunc = function(e,id){};
        } else {
          caller = setDirEl;
          evFunc = handleSelectDir;
        }
      }

      console.debug(leaf);
      return (
        <TreeItem key={leaf.id} nodeId={leaf.id}
                  label={leaf.name} icon={icon}
                  onDoubleClick={(e) => expanded(e,leaf.id)}
                  onClick={(e) => evFunc(e,leaf.id)}
                  onContextMenu={(e) => showMenu(e,caller)}
                  children={children} />
      );
    });
  };

  return (<>

    {/** ツリーの表示 */}
    <TreeView id="tree" className='treeText'
              selected={selected}
              expanded={expand}
              aria-label="binder system navigator">
      {getTreeItemsFromData(tree)}
    </TreeView>

    {/** テンプレートメニュー */}
    <Menu anchorEl={templateEl}
      open={templateMenu}
      onClose={() => closeMenu(setTemplateEl)}>
      <MenuItem onClick={(e) => handleEditTemplate(e,setTemplateEl)}>Edit</MenuItem>
    </Menu>

    {/** ディレクトリメニュー */}
    <Menu anchorEl={dirEl}
      open={dirMenu}
      onClose={() => closeMenu(setDirEl)}>
      <MenuItem onClick={(e) => handleRegisterTemplate(e,setDirEl)}>Add Template</MenuItem>
    </Menu>


  </>);
}
export default TemplateTree;