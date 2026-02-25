import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AttachFileIcon from '@mui/icons-material/AttachFile';

import { OpenBinderSite, GetBinderTree } from '../../../bindings/binder/api/app';

import Event, { EventContext } from '../../Event';
import CustomTreeItem, { EndIcon } from '../../components/TreeItem';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';

/**
 * Mermaid アイコン
 * @param {*} props 
 * @returns 
 */
function MermaidSVG(props) {
  return (<>
    <svg width={props.width} height={props.height} style={{ "padding": "2px", "marginRight": "6px" }} viewBox="0 0 491 491">
      <path d="M490.16,84.61C490.16,37.912 452.248,0 405.55,0L84.61,0C37.912,0 0,37.912 0,84.61L0,405.55C0,452.248 37.912,490.16 84.61,490.16L405.55,490.16C452.248,490.16 490.16,452.248 490.16,405.55L490.16,84.61Z"
        fill={props.fill} />
      <path d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z"
      />
    </svg>
  </>);
}

function MermaidIcon() {
  return <MermaidSVG width="20px" height="20px" fill="white" contents="black" />
}

{/** バインダーのツリー */ }
function BinderTree(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();

  //ツリーデータ
  const [tree, setTree] = useState([]);

  //選択しているID
  const [id, setId] = useState("note/index");

  //リソースを作成
  const viewTree = () => {
    GetBinderTree().then((resp) => {
      setTree(resp.data);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  useEffect(() => {
    //再描画を追加しておく
    evt.register("BinderTree", Event.ReloadTree, () => {
      console.log("Reload Tree")
      viewTree();
    })
    viewTree();
  }, [])

  const [expand, setExpand] = useState([id]);

  const [noteEl, setNoteEl] = useState(null);
  const noteMenu = Boolean(noteEl);

  const [diagramEl, setDiagramEl] = useState(null);
  const diagramMenu = Boolean(diagramEl);

  const [assetEl, setAssetEl] = useState(null);
  const assetMenu = Boolean(assetEl);

  //メニュー表示
  const showMenu = (e, call,itemId) => {
    e.preventDefault();
    call(e.target,itemId);
    e.stopPropagation();
  }

  //メニューを閉じる
  const closeMenu = (call) => {
    setId(undefined);
    call(null);
  };

  const setCurrentId = (itemId) => {
    setId(itemId);
  }

  //ノート作成
  const handleRegisterNote = (e, call) => {
    closeMenu(call);
    nav("/note/register/" + id);
  }

  //ノート編集
  const handleEditNote = (e, call) => {
    closeMenu(call);
    nav("/note/edit/" + id);
  }

  //ダイアグラム作成
  const handleRegisterDiagram = (e, call) => {
    closeMenu(call);
    nav("/diagram/register/" + id);
  }

  // アセット作成
  const handleRegisterAssets = (e, call) => {
    closeMenu(call);
    nav("/assets/register/" + id);
  }

  //ダイアグラム編集
  const handleEditDiagram = (e, call) => {
    closeMenu(call);
    nav("/diagram/edit/" + id);
  }

  //ダイアグラム編集
  const handleEditAsset = (e, call) => {
    closeMenu(call);
    nav("/assets/edit/" + id);
  }

  /**
   * ダイアログのみかどうか
   */
  const onlyDiagram = (list) => {
    var only = true;
    list.forEach((v) => {
      if (v.type !== "diagram") {
        only = false;
      }
    })
    return only;
  }

  //ツリー描画　
  const getTreeItemsFromData = leafs => {

    if (leafs === null) {
      //return <></>;
    }

    return leafs.map(leaf => {

      let children = [];
      if (leaf.children && leaf.children.length > 0) {
        children = getTreeItemsFromData(leaf.children);
      }

      var icon = TextSnippetIcon;
      var caller = setNoteEl;

      if (leaf.type === "diagram") {
        caller = setDiagramEl;
        icon = MermaidIcon
      } else if (leaf.type === "asset") {
        caller = setAssetEl;
        icon = AttachFileIcon
      } else if (children && children.length > 0) {
        if (onlyDiagram(leaf.children)) {
          icon = LibraryBooksIcon
        } else {
          icon = FolderIcon
        }
      }

      console.debug(leaf);
      //onClick={(e) => evFunc(e, leaf.id)}
      //onDoubleClick={(e) => handleExpand(e,leaf)}

      let itemId = leaf.type + "/" + leaf.id;
      return (
        <CustomTreeItem key={leaf.id} itemId={leaf.type + "/" + leaf.id}
                        label={leaf.name} labelIcon={icon}
                        onContextMenu={(e) => showMenu(e, caller,itemId)}
                        children={children} />
      );
    });
  };

  const handleItemToggle = (e,itemId,isSelected) => {
    var [type,id] = itemId.split("/");
    if ( isSelected ) {
      setCurrentId(id);
      nav("/editor/" + itemId);
    }
  }

  const handleExpanded = (e,items) => {
    setExpand(items);
  }

  return (<>

    {/** ツリーの表示 */}
    <SimpleTreeView id="tree" className='treeText'
      expandedItems={expand}
      onItemSelectionToggle={handleItemToggle}
      onExpandedItemsChange={handleExpanded}
      slots={{
        expandIcon: ArrowRightIcon,
        collapseIcon: ArrowDropDownIcon,
        endIcon: EndIcon,
      }}
      aria-label="binder system navigator">
      {getTreeItemsFromData(tree)}
    </SimpleTreeView>

    {/** 以下ツリー用のメニュ－ */}
    {/** ノートメニュー 
      編集 
      ------------
      ノートの追加
      データの追加
      アセットの追加
      */}
    <Menu anchorEl={noteEl}
      open={noteMenu}
      onClose={() => closeMenu(setNoteEl)}>
      <MenuItem onClick={(e) => handleEditNote(e, setNoteEl)} divider>Edit</MenuItem>
      <MenuItem onClick={(e) => handleRegisterNote(e, setNoteEl)}>Add Note</MenuItem>
      <MenuItem onClick={(e) => handleRegisterDiagram(e, setNoteEl)}>Add Diagram</MenuItem>
      <MenuItem onClick={(e) => handleRegisterAssets(e, setNoteEl)}>Add Assets</MenuItem>
    </Menu>

    {/** ダイアグラムメニュー 
      編集
      */}
    <Menu anchorEl={diagramEl}
      open={diagramMenu}
      onClose={() => closeMenu(setDiagramEl)}>
      <MenuItem onClick={(e) => handleEditDiagram(e, setDiagramEl)}>Edit</MenuItem>
    </Menu>

    {/** アセットメニュー 
      編集
      */}
    <Menu anchorEl={assetEl}
      open={assetMenu}
      onClose={() => closeMenu(setAssetEl)}>
      <MenuItem onClick={(e) => handleEditAsset(e, setAssetEl)}>Edit</MenuItem>
    </Menu>

  </>);
}
export default BinderTree;