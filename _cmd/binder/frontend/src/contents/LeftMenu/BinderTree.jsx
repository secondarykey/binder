import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem } from '@mui/material';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AttachFileIcon from '@mui/icons-material/AttachFile';

import { GetBinderTree, MoveNode } from '../../../bindings/binder/api/app';

import Event, { EventContext } from '../../Event';
import Tree from '../../components/Tree';

/**
 * Mermaid アイコン
 * @param {*} props
 * @returns
 */
function MermaidSVG(props) {
  return (<>
    <svg width={props.width} height={props.height} style={{ "padding": "2px" }} viewBox="0 0 491 491">
      <path d="M490.16,84.61C490.16,37.912 452.248,0 405.55,0L84.61,0C37.912,0 0,37.912 0,84.61L0,405.55C0,452.248 37.912,490.16 84.61,490.16L405.55,490.16C452.248,490.16 490.16,452.248 490.16,405.55L490.16,84.61Z"
        fill={props.fill} />
      <path d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z"
      />
    </svg>
  </>);
}

function MermaidIcon() {
  return <MermaidSVG width="20px" height="20px" fill="white" contents="black" />;
}

/**
 * ツリー表示用のアイコンマップ
 * - folder / folderOpen: 子を持つノート（FolderIcon）
 * - folderDiagram: 子がすべてダイアグラムのノート（LibraryBooksIcon）
 * - note / diagram / asset: 各リーフノード
 */
const binderIcons = {
  note:          <TextSnippetIcon fontSize="small" />,
  diagram:       <MermaidIcon />,
  asset:         <AttachFileIcon fontSize="small" />,
  folder:        <FolderIcon fontSize="small" />,
  folderOpen:    <FolderIcon fontSize="small" />,
  folderDiagram: <LibraryBooksIcon fontSize="small" />,
};

/**
 * 子ノードがすべてダイアグラムかどうか
 */
const onlyDiagram = (list) => list.every(v => v.type === "diagram");

/**
 * GetBinderTree() の戻り値をカスタムTreeコンポーネント用に変換する
 * - 子を持つ note → displayType を "folder" or "folderDiagram" に変換
 * - nodeType に元の type を保持（コンテキストメニュー判定用）
 */
const processTreeData = (leafs) => {
  if (!leafs) return [];
  return leafs.map(leaf => {
    const children = leaf.children ? processTreeData(leaf.children) : undefined;
    const hasChildren = children && children.length > 0;

    let displayType = leaf.type;
    if (leaf.type === "note" && hasChildren) {
      displayType = onlyDiagram(leaf.children) ? "folderDiagram" : "folder";
    }

    return {
      id: leaf.id,
      name: leaf.name,
      type: displayType,    // アイコン表示用（folder/folderDiagram/note/diagram/asset）
      nodeType: leaf.type,  // コンテキストメニュー判定用（元のtype）
      children: hasChildren ? children : undefined,
    };
  });
};

{/** バインダーのツリー */ }
function BinderTree(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();

  // ツリーデータ（APIから取得した生データ）
  const [tree, setTree] = useState([]);

  // 展開しているノードのID配列
  const [expand, setExpand] = useState([]);

  // 選択中のノードID
  const [selectedId, setSelectedId] = useState(null);

  // コンテキストメニューの状態
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, node: null });

  // ツリーデータを取得する。
  // expandTop=true の場合、取得後にトップ階層のノードをすべて展開する。
  // expandTop=false（ReloadTree 等）の場合は展開状態を維持する。
  const viewTree = (expandTop = false) => {
    GetBinderTree().then((resp) => {
      setTree(resp.data);
      if (expandTop) {
        const topIds = (resp.data || []).map(n => n.id);
        setExpand(topIds);
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  useEffect(() => {
    // ツリー内容変更時の再描画（展開状態は維持）
    evt.register("BinderTree", Event.ReloadTree, () => {
      viewTree();
    });
    // バインダーを開いたとき（LoadBinder 成功後）に再取得してトップ展開
    evt.register("BinderTree", Event.ChangeAddress, () => {
      viewTree(true);
    });
    // 初回表示時もトップ階層を展開
    viewTree(true);
  }, []);

  // Treeコンポーネント用データ（メモ化）
  const treeData = useMemo(() => processTreeData(tree), [tree]);

  // ---- ハンドラ ----

  /** 展開/折りたたみトグル */
  const handleExpand = (nodeId) => {
    setExpand(prev =>
      prev.includes(nodeId) ? prev.filter(i => i !== nodeId) : [...prev, nodeId]
    );
  };

  /** ノードクリック → エディタへナビゲート */
  const handleClick = (node) => {
    const type = node.nodeType || node.type;
    nav("/editor/" + type + "/" + node.id);
  };

  /** コンテキストメニューを開く */
  const handleContextMenu = (e, node) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, node });
  };

  /** コンテキストメニューを閉じる */
  const closeContextMenu = () => {
    setContextMenu({ open: false, x: 0, y: 0, node: null });
  };

  /** D&D: parentId と childIds を使って Seq を更新する */
  const handleChange = (changeInfo) => {
    const parentId = changeInfo.parentId ?? "";
    MoveNode(parentId, changeInfo.childIds).then(() => {
      viewTree();
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // ---- コンテキストメニューのナビゲーションハンドラ ----

  const handleEditNote        = () => { closeContextMenu(); nav("/note/edit/"        + contextMenu.node.id); };
  const handleRegisterNote    = () => { closeContextMenu(); nav("/note/register/"    + contextMenu.node.id); };
  const handleRegisterDiagram = () => { closeContextMenu(); nav("/diagram/register/" + contextMenu.node.id); };
  const handleRegisterAssets  = () => { closeContextMenu(); nav("/assets/register/"  + contextMenu.node.id); };
  const handleEditDiagram     = () => { closeContextMenu(); nav("/diagram/edit/"     + contextMenu.node.id); };
  const handleEditAsset       = () => { closeContextMenu(); nav("/assets/edit/"      + contextMenu.node.id); };

  // 現在右クリックされているノードの元type
  const contextNodeType = contextMenu.node?.nodeType;

  return (<>

    {/** カスタムツリー */}
    <Tree
      data={treeData}
      selected={selectedId}
      onSelect={(id) => setSelectedId(id)}
      onClick={handleClick}
      expand={expand}
      onExpand={handleExpand}
      onChange={handleChange}
      onNodeContextMenu={handleContextMenu}
      icons={binderIcons}
    />

    {/** ノートメニュー: Edit / Add Note / Add Diagram / Add Assets */}
    <Menu
      open={contextMenu.open && contextNodeType === "note"}
      onClose={closeContextMenu}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <MenuItem onClick={handleEditNote} divider>Edit</MenuItem>
      <MenuItem onClick={handleRegisterNote}>Add Note</MenuItem>
      <MenuItem onClick={handleRegisterDiagram}>Add Diagram</MenuItem>
      <MenuItem onClick={handleRegisterAssets}>Add Assets</MenuItem>
    </Menu>

    {/** ダイアグラムメニュー: Edit */}
    <Menu
      open={contextMenu.open && contextNodeType === "diagram"}
      onClose={closeContextMenu}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <MenuItem onClick={handleEditDiagram}>Edit</MenuItem>
    </Menu>

    {/** アセットメニュー: Edit */}
    <Menu
      open={contextMenu.open && contextNodeType === "asset"}
      onClose={closeContextMenu}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <MenuItem onClick={handleEditAsset}>Edit</MenuItem>
    </Menu>

  </>);
}

export default BinderTree;
