import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem } from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';

import { GetTemplateTree } from '../../../bindings/binder/api/app';

import Event, { EventContext } from '../../Event';

{/** HTMLテンプレートのツリー（layout / content） */}
function TemplateTree(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const [tree, setTree] = useState([]);
  const [id, setId] = useState(undefined);

  const [selected, setSelected] = useState(["DIR_HTML"]);
  const [expand, setExpand] = useState(["DIR_HTML"]);

  const viewTree = () => {
    GetTemplateTree().then((resp) => {
      setTree(resp.data);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  useEffect(() => {
    evt.register("TemplateTree", Event.ReloadTree, () => {
      viewTree();
    });
    viewTree();
  }, []);

  const [dirEl, setDirEl] = useState(null);
  const dirMenu = Boolean(dirEl);
  const [templateEl, setTemplateEl] = useState(null);
  const templateMenu = Boolean(templateEl);

  const showMenu = (e, call) => {
    e.preventDefault();
    call(e.target);
    e.stopPropagation();
  }

  const closeMenu = (call) => {
    setId(undefined);
    call(null);
  };

  const toggleList = (src, id) => {
    var ex = false;
    var list = [];
    src.map((v) => {
      if (v !== id) {
        list.push(v);
      } else {
        ex = true;
      }
    });
    if (!ex) {
      list.push(id);
    }
    return list;
  }

  const expanded = (e, selectId) => {
    e.preventDefault();
    if (id === selectId) {
      var wk = toggleList(expand, selectId);
      setExpand(wk);
    }
  }

  const setCurrentId = (id) => {
    setId(id);
    setSelected([id]);
  }

  // テンプレート新規作成（ディレクトリ右クリックメニュー）
  const handleRegisterTemplate = (e, call) => {
    closeMenu(call);
    nav("/template/register/" + id);
  }

  // テンプレートメタ情報編集（テンプレート右クリックメニュー）
  const handleEditTemplate = (e, call) => {
    closeMenu(call);
    nav("/template/edit/" + id);
  }

  // テンプレート本文を開く（テンプレートシングルクリック）
  const handleTemplateOpen = (e, id) => {
    setCurrentId(id);
    nav("/editor/template/" + id);
  }

  const getTreeItemsFromData = leafs => {

    if (leafs === null) {
      return [];
    }

    return leafs.map(leaf => {

      let children = [];
      if (leaf.children && leaf.children.length > 0) {
        children = getTreeItemsFromData(leaf.children);
      }

      var icon = <TextSnippetIcon />;
      var caller = setTemplateEl;
      var evFunc = handleTemplateOpen;

      if (leaf.id.indexOf("DIR_") === 0) {
        icon = <FolderIcon />;
        if (leaf.id === "DIR_HTML") {
          // HTML ルートは直接操作不可
          caller = function(e) {};
          evFunc = function(e, id) {};
        } else {
          // Layout / Content ディレクトリ：右クリックで Add Template
          caller = setDirEl;
          evFunc = function(e, id) { setCurrentId(id); };
        }
      }

      return (
        <TreeItem key={leaf.id} itemId={leaf.id}
          label={leaf.name} icon={icon}
          onDoubleClick={(e) => expanded(e, leaf.id)}
          onClick={(e) => evFunc(e, leaf.id)}
          onContextMenu={(e) => showMenu(e, caller)}
          children={children} />
      );
    });
  };

  return (<>

    <SimpleTreeView id="tree" className='treeText'
      selected={selected}
      expanded={expand}
      aria-label="template navigator">
      {getTreeItemsFromData(tree)}
    </SimpleTreeView>

    {/** テンプレートメニュー（右クリック） */}
    <Menu anchorEl={templateEl}
      open={templateMenu}
      onClose={() => closeMenu(setTemplateEl)}>
      <MenuItem onClick={(e) => handleEditTemplate(e, setTemplateEl)}>Edit</MenuItem>
    </Menu>

    {/** ディレクトリメニュー（右クリック） */}
    <Menu anchorEl={dirEl}
      open={dirMenu}
      onClose={() => closeMenu(setDirEl)}>
      <MenuItem onClick={(e) => handleRegisterTemplate(e, setDirEl)}>Add Template</MenuItem>
    </Menu>

  </>);
}
export default TemplateTree;
