import { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem, Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';
import AttachFileIcon from '@mui/icons-material/AttachFile';

import { Events } from '@wailsio/runtime';

import { GetBinderTree, GetModifiedIds, MoveNode, DropAsset, RemoveNote, RemoveDiagram, RemoveAsset,
         EditNote, EditDiagram, EditAsset, SelectFile, GetHTMLTemplates,
         OpenHistoryWindow } from '../../../bindings/binder/api/app';

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
  return <MermaidSVG width="16px" height="16px" fill="currentColor" contents="black" />;
}

/**
 * ツリー表示用のアイコンマップ
 * - folder / folderOpen: 子を持つノート（FolderIcon）
 * - note / diagram / asset: 各リーフノード
 */
const binderIcons = {
  note:       <TextSnippetIcon fontSize="small" />,
  diagram:    <MermaidIcon />,
  asset:      <AttachFileIcon fontSize="small" />,
  folder:     <FolderIcon fontSize="small" />,
  folderOpen: <FolderIcon fontSize="small" />,
};

/**
 * ツリー（生データ）を id で再帰検索する
 */
const findNodeInTree = (nodes, id) => {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeInTree(node.children, id);
    if (found) return found;
  }
  return null;
};

/**
 * GetBinderTree() の戻り値をカスタムTreeコンポーネント用に変換する
 * - 子を持つ note → displayType を "folder" に変換
 * - nodeType に元の type を保持（コンテキストメニュー判定用）
 */
const processTreeData = (leafs, modifiedIds) => {
  if (!leafs) return [];
  return leafs.map(leaf => {
    const children = leaf.children ? processTreeData(leaf.children, modifiedIds) : undefined;
    const hasChildren = children && children.length > 0;

    const displayType = (leaf.type === "note" && hasChildren) ? "folder" : leaf.type;

    return {
      id: leaf.id,
      name: leaf.name,
      type: displayType,                                           // アイコン表示用（folder/note/diagram/asset）
      nodeType: leaf.type,                                         // コンテキストメニュー判定用（元のtype）
      modified: modifiedIds ? modifiedIds.has(leaf.id) : false,   // Git未コミット変更フラグ
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

  // Git変更済みIDのSet（ツリー表示後に非同期で取得）
  const [modifiedIds, setModifiedIds] = useState(null);

  // 展開しているノードのID配列
  const [expand, setExpand] = useState([]);

  // 選択中のノードID
  const [selectedId, setSelectedId] = useState(null);

  // コンテキストメニューの状態
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, node: null });

  // Add サブメニューのアンカー要素
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);

  // 削除確認ダイアログの状態
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, node: null });

  // paste イベントハンドラ内で最新値を参照するための ref
  const selectedIdRef = useRef(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const treeRef = useRef([]);
  useEffect(() => { treeRef.current = tree; }, [tree]);

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
      // ツリー表示後に非同期でGit変更状態を取得して色を反映
      GetModifiedIds().then((ids) => {
        console.log('[BinderTree] GetModifiedIds:', ids);
        setModifiedIds(new Set(ids ?? []));
      }).catch((err) => {
        console.error('[BinderTree] GetModifiedIds error:', err);
      });
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

  useEffect(() => {
    // Wails ネイティブファイルドロップ: Go ハンドラ (main.go) がファイルを受け取り、
    // アセット登録後に binder:filedrop:done を発行する。エラー時は binder:error を発行。
    const cleanupDone = Events.On('binder:filedrop:done', () => {
      viewTree();
    });
    const cleanupError = Events.On('binder:error', (event) => {
      evt.showErrorMessage(event.data ?? event);
    });
    return () => {
      cleanupDone();
      cleanupError();
    };
  }, []);

  useEffect(() => {
    // クリップボード画像貼り付け: 選択中ノートが note の場合、画像をアセットとして登録する。
    // selectedIdRef / treeRef を使って最新の状態を参照する。
    const handlePaste = (e) => {
      const id = selectedIdRef.current;
      if (!id) return;

      // 生データから選択ノードを検索し note 型かチェック
      const node = findNodeInTree(treeRef.current, id);
      if (!node || node.type !== 'note') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      // MIME サブタイプを拡張子に変換（image/jpeg → jpg）
      const ext = imageItem.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
      const filename = `clipboard-${Date.now()}.${ext}`;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        if (!base64) {
          evt.showWarningMessage('クリップボード画像のデータが空です');
          return;
        }
        const asset = {
          Id: '',
          ParentId: id,
          Name: filename,
          Alias: filename,
          Detail: '',
          Binary: false,
        };
        DropAsset(asset, filename, base64).then((result) => {
          viewTree();
          // アセット登録後、エディタのカーソル位置に {{assetsImage "id"}} を挿入
          if (result?.id) {
            evt.insertText(`{{assetsImage "${result.id}"}}`);
          }
        }).catch((err) => {
          evt.showErrorMessage(err);
        });
      };
      reader.readAsDataURL(file);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Treeコンポーネント用データ（メモ化）
  const treeData = useMemo(() => processTreeData(tree, modifiedIds), [tree, modifiedIds]);

  // ---- ハンドラ ----

  /** 展開/折りたたみトグル */
  const handleExpand = (nodeId) => {
    setExpand(prev =>
      prev.includes(nodeId) ? prev.filter(i => i !== nodeId) : [...prev, nodeId]
    );
  };

  /** ノードクリック → エディタ or ビューアへナビゲート */
  const handleClick = (node) => {
    const type = node.nodeType || node.type;
    if (type === 'asset') {
      nav("/assets/view/" + node.id);
    } else {
      nav("/editor/" + type + "/" + node.id);
    }
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

  /** コンテキストメニューとAddサブメニューをまとめて閉じる */
  const closeAllMenus = () => {
    setAddMenuAnchor(null);
    setContextMenu({ open: false, x: 0, y: 0, node: null });
  };

  /** Addサブメニューを開く */
  const handleAddMenuOpen = (e) => {
    setAddMenuAnchor(e.currentTarget);
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

  const handleEditNote        = () => { closeAllMenus(); nav("/note/edit/"        + contextMenu.node.id); };
  const handleEditDiagram     = () => { closeAllMenus(); nav("/diagram/edit/"     + contextMenu.node.id); };
  const handleEditAsset       = () => { closeAllMenus(); nav("/assets/edit/"      + contextMenu.node.id); };

  const handleHistoryNote    = () => { closeAllMenus(); OpenHistoryWindow('note',    contextMenu.node.id).catch(err => evt.showErrorMessage(err)); };
  const handleHistoryDiagram = () => { closeAllMenus(); OpenHistoryWindow('diagram', contextMenu.node.id).catch(err => evt.showErrorMessage(err)); };

  /** ノートをデフォルト値で即時作成してエディタへ */
  const handleRegisterNote = async () => {
    const parentId = contextMenu.node.id;
    closeAllMenus();
    try {
      const tmpls = await GetHTMLTemplates();
      const note = {
        id: "",
        parentId,
        name: "New Note",
        alias: "",
        detail: "",
        layoutTemplate: tmpls.layouts[0].id,
        contentTemplate: tmpls.contents[0].id,
      };
      const resp = await EditNote(note, "");
      evt.refreshTree();
      nav("/editor/note/" + resp.id);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  /** ダイアグラムをデフォルト値で即時作成してエディタへ */
  const handleRegisterDiagram = async () => {
    const parentId = contextMenu.node.id;
    closeAllMenus();
    try {
      const diagram = { id: "", parentId, name: "New Diagram", alias: "", detail: "" };
      const resp = await EditDiagram(diagram);
      evt.refreshTree();
      nav("/editor/diagram/" + resp.id);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  /** ファイル選択後にアセットを作成してエディタへ */
  const handleRegisterAssets = async () => {
    const parentId = contextMenu.node.id;
    closeAllMenus();
    try {
      const filePath = await SelectFile("Any File", "*");
      if (!filePath) return;
      const name = filePath.split(/[/\\]/).pop() || "New Asset";
      const asset = { id: "", parentId, name, alias: "", detail: "", binary: false };
      const resp = await EditAsset(asset, filePath);
      evt.refreshTree();
      nav("/editor/assets/" + resp.id);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  /** 削除確認ダイアログを開く */
  const handleDeleteRequest = () => {
    const node = contextMenu.node;
    closeAllMenus();
    setDeleteConfirm({ open: true, node });
  };

  /** 削除確認後の実行 */
  const handleDeleteConfirm = () => {
    const { node } = deleteConfirm;
    setDeleteConfirm({ open: false, node: null });
    if (!node) return;

    const type = node.nodeType || node.type;
    const remove =
      type === 'note'    ? RemoveNote(node.id) :
      type === 'diagram' ? RemoveDiagram(node.id) :
                           RemoveAsset(node.id);

    remove.then(() => {
      evt.refreshTree();
      evt.showSuccessMessage("Deleted.");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  /** 削除をキャンセル */
  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, node: null });
  };

  // 現在右クリックされているノードの元type
  const contextNodeType = contextMenu.node?.nodeType;

  return (<>

    {/** カスタムツリー */}
    <div style={{ marginTop: '4px' }}><Tree
      data={treeData}
      selected={selectedId}
      onSelect={(id) => setSelectedId(id)}
      onClick={handleClick}
      expand={expand}
      onExpand={handleExpand}
      onChange={handleChange}
      onNodeContextMenu={handleContextMenu}
      icons={binderIcons}
    /></div>

    {/** ノートメニュー: Edit / Add ▶ / History / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "note"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleEditNote} divider>Edit</MenuItem>
      <MenuItem onClick={handleAddMenuOpen} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Add</span><span>▶</span>
      </MenuItem>
      <MenuItem onClick={handleHistoryNote} divider>History</MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: '#f44336' }}>Delete</MenuItem>
    </Menu>

    {/** Add サブメニュー: Note / Diagram / Assets */}
    <Menu
      open={Boolean(addMenuAnchor)}
      onClose={closeAllMenus}
      anchorEl={addMenuAnchor}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleRegisterNote}>Note</MenuItem>
      <MenuItem onClick={handleRegisterDiagram}>Diagram</MenuItem>
      <MenuItem onClick={handleRegisterAssets}>Assets</MenuItem>
    </Menu>

    {/** ダイアグラムメニュー: Edit / History / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "diagram"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleEditDiagram} divider>Edit</MenuItem>
      <MenuItem onClick={handleHistoryDiagram} divider>History</MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: '#f44336' }}>Delete</MenuItem>
    </Menu>

    {/** アセットメニュー: Edit / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "asset"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleEditAsset} divider>Edit</MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: '#f44336' }}>Delete</MenuItem>
    </Menu>

    {/** 削除確認ダイアログ */}
    <Dialog open={deleteConfirm.open} onClose={handleDeleteCancel}>
      <DialogTitle>
        「{deleteConfirm.node?.name}」を削除しますか？
      </DialogTitle>
      <DialogActions>
        <Button onClick={handleDeleteCancel}>Cancel</Button>
        <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
      </DialogActions>
    </Dialog>

  </>);
}

export default BinderTree;
