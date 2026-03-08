import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem, List, ListSubheader, ListItemButton, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import AddIcon from '@mui/icons-material/Add';

import { GetTemplateTree } from '../../../bindings/binder/api/app';

import Event, { EventContext } from '../../Event';

{/** HTMLテンプレートのリスト（layout / content） */}
function TemplateTree(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const [tree, setTree] = useState([]);
  const [id, setId] = useState(undefined);
  const [selectedId, setSelectedId] = useState(undefined);

  const [templateEl, setTemplateEl] = useState(null);
  const templateMenu = Boolean(templateEl);

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

  const closeMenu = () => {
    setId(undefined);
    setTemplateEl(null);
  };

  // テンプレート本文を開く（シングルクリック）
  const handleTemplateOpen = (e, leafId) => {
    setSelectedId(leafId);
    nav("/editor/template/" + leafId);
  }

  // テンプレート右クリックでコンテキストメニューを表示
  const handleContextMenu = (e, leafId) => {
    e.preventDefault();
    setId(leafId);
    setTemplateEl(e.currentTarget);
    e.stopPropagation();
  }

  // テンプレートメタ情報編集（右クリックメニューから）
  const handleEditTemplate = () => {
    setTemplateEl(null);
    nav("/template/edit/" + id);
    setId(undefined);
  }

  // テンプレート新規作成（セクションヘッダーの + ボタン）
  const handleRegisterTemplate = (dirId) => {
    nav("/template/register/" + dirId);
  }

  // tree データから指定ディレクトリの子アイテムを取得
  // バックエンドの構造: [{id:"DIR_HTML", children:[{id:"DIR_HTML_Layout",...},{id:"DIR_HTML_Content",...}]}]
  const getSection = (dirId) => {
    if (!tree || tree.length === 0) return [];
    const root = tree[0]; // DIR_HTML
    if (!root || !root.children) return [];
    const dir = root.children.find(c => c.id === dirId);
    return dir && dir.children ? dir.children : [];
  }

  const renderItems = (items) => {
    return items.map(item => (
      <ListItemButton key={item.id}
        selected={selectedId === item.id}
        onClick={(e) => handleTemplateOpen(e, item.id)}
        onContextMenu={(e) => handleContextMenu(e, item.id)}
        sx={{ pl: 2 }}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <TextSnippetIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={item.name} primaryTypographyProps={{ noWrap: true }} />
      </ListItemButton>
    ));
  }

  const layoutItems = getSection("DIR_HTML_Layout");
  const contentItems = getSection("DIR_HTML_Content");

  return (<>

    <List dense disablePadding className='treeText'>

      {/** Layout セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '32px', backgroundColor: 'transparent', color: 'inherit' }}>
        Layout
        <IconButton size="small" onClick={() => handleRegisterTemplate("DIR_HTML_Layout")}>
          <AddIcon fontSize="small" />
        </IconButton>
      </ListSubheader>
      {renderItems(layoutItems)}

      {/** Content セクション */}
      <ListSubheader disableSticky
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '32px', backgroundColor: 'transparent', color: 'inherit' }}>
        Content
        <IconButton size="small" onClick={() => handleRegisterTemplate("DIR_HTML_Content")}>
          <AddIcon fontSize="small" />
        </IconButton>
      </ListSubheader>
      {renderItems(contentItems)}

    </List>

    {/** テンプレートメニュー（右クリック） */}
    <Menu anchorEl={templateEl}
      open={templateMenu}
      onClose={closeMenu}>
      <MenuItem onClick={handleEditTemplate}>Edit</MenuItem>
    </Menu>

  </>);
}
export default TemplateTree;
