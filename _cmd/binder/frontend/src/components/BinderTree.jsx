import { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { Menu, MenuItem, Dialog, DialogTitle, DialogActions, Button, Tooltip, IconButton, Divider } from '@mui/material';

import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import FolderIcon from '@mui/icons-material/Folder';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import HistoryIcon from '@mui/icons-material/History';

import { Events, Browser } from '@wailsio/runtime';

import { GetBinderTree, GetModifiedIds, GetUnpublishedTree, MoveNode, DropAsset, RemoveNote, RemoveDiagram, RemoveAsset,
         EditNote, EditDiagram, EditAsset, GetNote, GetDiagram, GetAsset, GetHTMLTemplates, Address, GetFullPath,
         IsGitBashPath, GetGitBashFullPath } from '../../bindings/binder/api/app';

import { OpenHistoryWindow, OpenOverallHistoryWindow, SelectFile, DownloadDocs, DownloadAll } from '../../bindings/main/window';

import "../i18n/config";
import { useTranslation } from 'react-i18next';

import { copyClipboard } from '../app/App';

import Event, { EventContext } from '../Event';
import Tree from './Tree';
import NoteMetaDialog from '../dialogs/NoteMetaDialog';
import DiagramMetaDialog from '../dialogs/DiagramMetaDialog';
import AssetMetaDialog from '../dialogs/AssetMetaDialog';

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
 * ツリー（生データ）を再帰検索し、対象ノードまでの祖先IDの配列を返す
 */
const findAncestorIds = (nodes, targetId, path = []) => {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === targetId) return path;
    const result = findAncestorIds(node.children, targetId, [...path, node.id]);
    if (result) return result;
  }
  return null;
};

/**
 * ツリー（生データ）から子を持つ全ノードのIDを収集する（展開可能なノード）
 */
const collectExpandableIds = (nodes, ids = []) => {
  if (!nodes) return ids;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.push(node.id);
      collectExpandableIds(node.children, ids);
    }
  }
  return ids;
};

/**
 * GetBinderTree() の戻り値をカスタムTreeコンポーネント用に変換する
 * - 子を持つ note → displayType を "folder" に変換
 * - nodeType に元の type を保持（コンテキストメニュー判定用）
 */
const processTreeData = (leafs, modifiedIds, showModified, unpublishedMap, showPublishStatus) => {
  if (!leafs) return [];
  return leafs.map(leaf => {
    const children = leaf.children ? processTreeData(leaf.children, modifiedIds, showModified, unpublishedMap, showPublishStatus) : undefined;
    const hasChildren = children && children.length > 0;

    const displayType = (leaf.type === "note" && hasChildren) ? "folder" : leaf.type;

    return {
      id: leaf.id,
      name: leaf.name,
      type: displayType,                                                                          // アイコン表示用（folder/note/diagram/asset）
      nodeType: leaf.type,                                                                        // コンテキストメニュー判定用（元のtype）
      modified: showModified && modifiedIds ? modifiedIds.has(leaf.id) : false,                  // Git未コミット変更フラグ（トグルOFF時は強制false）
      publishStatus: showPublishStatus && unpublishedMap ? (unpublishedMap.get(leaf.id) ?? 0) : 0, // 未公開ステータス（0:最新 1:未公開新規 2:更新あり）
      children: hasChildren ? children : undefined,
    };
  });
};

{/** バインダーのツリー */ }
function BinderTree(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const {t} = useTranslation();

  // ツリーデータ（APIから取得した生データ）
  const [tree, setTree] = useState([]);

  // Git変更済みIDのSet（ツリー表示後に非同期で取得）
  const [modifiedIds, setModifiedIds] = useState(null);

  // 表示モード: 'none' | 'commit' | 'publish'
  const [displayMode, setDisplayMode] = useState('commit');
  const displayModeRef = useRef('commit');

  // 表示モードから派生するフラグ
  const showModified = displayMode === 'commit';
  const showPublishStatus = displayMode === 'publish';

  // 未公開IDマップ（id → publishStatus）
  const [unpublishedMap, setUnpublishedMap] = useState(null);

  // MoreVert メニューの状態（ボタンクリック・エリア右クリック共用）
  // el が非null のときは anchorEl 基準（ボタン右下寄せ）、null のときは anchorPosition 基準（カーソル位置）
  const [moreMenu, setMoreMenu] = useState({ open: false, el: null, x: 0, y: 0 });
  const openMoreMenuAt = (x, y) => setMoreMenu({ open: true, el: null, x, y });
  const openMoreMenuEl = (el) => setMoreMenu({ open: true, el, x: 0, y: 0 });
  const closeMoreMenu = () => setMoreMenu({ open: false, el: null, x: 0, y: 0 });

  // バインダーのサイトURL（ブラウザで開くボタン用）
  const [siteUrl, setSiteUrl] = useState("");
  useEffect(() => { displayModeRef.current = displayMode; }, [displayMode]);

  // 展開しているノードのID配列
  const [expand, setExpand] = useState([]);

  // 選択中のノードID
  const [selectedId, setSelectedId] = useState(null);

  // コンテキストメニューの状態
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, node: null });

  // Add サブメニューのアンカー要素
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);

  // ダウンロードサブメニューのアンカー要素
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);

  // Copy サブメニューのアンカー要素
  const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);

  // エディタ引数に {bfile} が含まれる場合に true（右クリック都度判定）
  const [showGitBashPath, setShowGitBashPath] = useState(false);

  // 削除確認ダイアログの状態
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, node: null });

  // メタ編集ダイアログの状態
  const [editDialog, setEditDialog] = useState({ open: false, type: null, id: null });

  // インラインリネームの状態
  const [renaming, setRenaming] = useState(null); // リネーム中のノードID
  const [renamingValue, setRenamingValue] = useState(''); // 編集中の名前
  // リネーム確定/キャンセル後にナビゲートする URL（新規作成フローで使用）
  const navAfterRenameRef = useRef(null);

  // paste イベントハンドラ内で最新値を参照するための ref
  const selectedIdRef = useRef(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const treeRef = useRef([]);
  useEffect(() => { treeRef.current = tree; }, [tree]);

  // 現在のバインダーアドレスを追跡する ref。
  // ChangeAddress 発火時に「本当に別バインダーへ切り替わったか」を判定するために使う。
  // 別バインダーのときだけ expandTop=true（トップ展開リセット）を呼ぶ。
  const currentAddressRef = useRef(null);

  // ツリーデータを取得する。
  // expandTop=true の場合、取得後にトップ階層のノードをすべて展開する。
  // expandTop=false（ReloadTree 等）の場合は展開状態を維持する。
  // 未公開ステータスマップを構築する（id → publishStatus）
  const loadUnpublished = () => {
    GetUnpublishedTree().then((tree) => {
      const map = new Map();
      (tree.data ?? []).forEach((dir) => {
        (dir.children ?? []).forEach((leaf) => {
          if (leaf.publishStatus) map.set(leaf.id, leaf.publishStatus);
        });
      });
      setUnpublishedMap(map);
    }).catch((err) => {
      console.error('[BinderTree] GetUnpublishedTree error:', err);
    });
  };

  const viewTree = (expandTop = false) => {
    GetBinderTree().then((resp) => {
      setTree(resp.data);
      if (expandTop) {
        const topIds = (resp.data || []).map(n => n.id);
        setExpand(topIds);
      }
      // ツリー表示後に非同期でGit変更状態を取得して色を反映
      GetModifiedIds().then((ids) => {
        setModifiedIds(new Set(ids ?? []));
      }).catch((err) => {
        console.error('[BinderTree] GetModifiedIds error:', err);
      });
      // 未公開表示ONの場合は未公開データも再取得
      if (displayModeRef.current === 'publish') loadUnpublished();
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  useEffect(() => {
    // ツリー内容変更時の再描画（展開状態は維持）
    evt.register("BinderTree", Event.ReloadTree, () => {
      viewTree();
    });
    // バインダーを開いたとき（LoadBinder 成功後）に再取得。
    // アドレスが変わった（別バインダー）ときだけトップ展開リセット。
    // 同じバインダーの再ロードや画面遷移では展開状態を維持する。
    evt.register("BinderTree", Event.ChangeAddress, (addr) => {
      setSiteUrl(addr);
      const isNewBinder = addr !== currentAddressRef.current;
      currentAddressRef.current = addr;
      viewTree(isNewBinder);
    });
    // 初期URLを取得
    Address().then((addr) => { setSiteUrl(addr); }).catch(() => {});
    // 履歴復元などでツリーのノード選択を外部から更新する
    evt.register("BinderTree", Event.SelectTree, (id) => {
      setSelectedId(id);
      // 対象ノードまでの祖先を展開する
      const ancestors = findAncestorIds(treeRef.current, id);
      if (ancestors && ancestors.length > 0) {
        setExpand(prev => {
          const set = new Set(prev);
          ancestors.forEach(a => set.add(a));
          return [...set];
        });
      }
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
          evt.showWarningMessage(t("tree.clipboardEmpty"));
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

  // 未公開表示トグルON→データ取得 / OFF→マップクリア
  useEffect(() => {
    if (showPublishStatus) {
      loadUnpublished();
    } else {
      setUnpublishedMap(null);
    }
  }, [showPublishStatus]);

  // Treeコンポーネント用データ（メモ化）
  const treeData = useMemo(
    () => processTreeData(tree, modifiedIds, showModified, unpublishedMap, showPublishStatus),
    [tree, modifiedIds, showModified, unpublishedMap, showPublishStatus]
  );

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
      // エディタルート経由で表示し、BinderTree インスタンスを editor と統一する
      nav("/editor/assets/" + node.id);
    } else {
      nav("/editor/" + type + "/" + node.id);
    }
  };

  /** コンテキストメニューを開く */
  const handleContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation(); // エリア右クリックへのバブリングを防ぐ
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, node });
    IsGitBashPath().then(setShowGitBashPath).catch(() => setShowGitBashPath(false));
  };

  /** コンテキストメニューを閉じる */
  const closeContextMenu = () => {
    setContextMenu({ open: false, x: 0, y: 0, node: null });
  };

  /** コンテキストメニューとAddサブメニューをまとめて閉じる */
  const closeAllMenus = () => {
    setAddMenuAnchor(null);
    setCopyMenuAnchor(null);
    setContextMenu({ open: false, x: 0, y: 0, node: null });
  };

  /** Addサブメニューを開く */
  const handleAddMenuOpen = (e) => {
    setAddMenuAnchor(e.currentTarget);
  };

  /** Copy サブメニューを開く */
  const handleCopyMenuOpen = (e) => {
    setCopyMenuAnchor(e.currentTarget);
  };

  /** Copy > ID */
  const handleCopyId = () => {
    const id = contextMenu.node.id;
    closeAllMenus();
    copyClipboard(id);
  };

  /** Copy > パス */
  const handleCopyPath = () => {
    const { id, nodeType } = contextMenu.node;
    closeAllMenus();
    GetFullPath(nodeType, id).then((path) => {
      if (path) copyClipboard(path);
    }).catch((err) => evt.showErrorMessage(err));
  };

  /** Copy > GitBash パス */
  const handleCopyGitBashPath = () => {
    const { id, nodeType } = contextMenu.node;
    closeAllMenus();
    GetGitBashFullPath(nodeType, id).then((path) => {
      if (path) copyClipboard(path);
    }).catch((err) => evt.showErrorMessage(err));
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

  const handleEditNote    = () => { closeAllMenus(); setEditDialog({ open: true, type: 'note',    id: contextMenu.node.id }); };
  const handleEditDiagram = () => { closeAllMenus(); setEditDialog({ open: true, type: 'diagram', id: contextMenu.node.id }); };
  const handleEditAsset   = () => { closeAllMenus(); setEditDialog({ open: true, type: 'asset',   id: contextMenu.node.id }); };
  const closeEditDialog   = () => setEditDialog({ open: false, type: null, id: null });

  const handleHistoryNote    = () => { closeAllMenus(); OpenHistoryWindow('note',    contextMenu.node.id, contextMenu.node.name ?? '').catch(err => evt.showErrorMessage(err)); };
  const handleHistoryDiagram = () => { closeAllMenus(); OpenHistoryWindow('diagram', contextMenu.node.id, contextMenu.node.name ?? '').catch(err => evt.showErrorMessage(err)); };

  /** リネーム開始: コンテキストメニューの "Rename" から呼び出す */
  const handleRenameStart = () => {
    const node = contextMenu.node;
    const { id, name } = node;
    closeAllMenus();
    // MUI メニューのアニメーション完了後に input を表示して autoFocus を確実に効かせる
    setTimeout(() => {
      setRenamingValue(name);
      setRenaming(id);
    }, 150);
  };

  /** リネーム確定: Enter 時に既存データを取得してから name のみ更新する */
  const handleRenameCommit = async () => {
    if (!renaming) return;
    const node = findNodeInTree(treeRef.current, renaming);
    const id = renaming;
    const nodeType = node?.nodeType || node?.type;
    const pendingUrl = navAfterRenameRef.current;
    navAfterRenameRef.current = null;
    setRenaming(null);

    const doNav = () => { if (pendingUrl) nav(pendingUrl); };

    if (!node) { doNav(); return; }
    const newName = renamingValue.trim();
    if (!newName || newName === node.name) { doNav(); return; }

    try {
      if (nodeType === 'note') {
        const current = await GetNote(id);
        if (!current) { doNav(); return; }
        await EditNote({ ...current, name: newName }, '');
      } else if (nodeType === 'diagram') {
        const current = await GetDiagram(id);
        if (!current) { doNav(); return; }
        await EditDiagram({ ...current, name: newName });
      } else if (nodeType === 'asset') {
        const current = await GetAsset(id);
        if (!current) { doNav(); return; }
        await EditAsset({ ...current, name: newName }, '');
      }
      evt.refreshTree();
      doNav();
    } catch (err) {
      evt.showErrorMessage(err);
      doNav();
    }
  };

  /** リネームキャンセル: 新規作成フローではデフォルト名のままエディタへ遷移 */
  const handleRenameCancel = () => {
    setRenaming(null);
    const pendingUrl = navAfterRenameRef.current;
    navAfterRenameRef.current = null;
    if (pendingUrl) nav(pendingUrl);
  };

  /** ノートをデフォルト値で作成 → インラインリネーム → エディタへ */
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
      setExpand(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
      evt.refreshTree();
      navAfterRenameRef.current = "/editor/note/" + resp.id;
      setTimeout(() => {
        setSelectedId(resp.id);
        setRenamingValue("New Note");
        setRenaming(resp.id);
      }, 150);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  /** ダイアグラムをデフォルト値で作成 → インラインリネーム → エディタへ */
  const handleRegisterDiagram = async () => {
    const parentId = contextMenu.node.id;
    closeAllMenus();
    try {
      const diagram = { id: "", parentId, name: "New Diagram", alias: "", detail: "" };
      const resp = await EditDiagram(diagram);
      setExpand(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
      evt.refreshTree();
      navAfterRenameRef.current = "/editor/diagram/" + resp.id;
      setTimeout(() => {
        setSelectedId(resp.id);
        setRenamingValue("New Diagram");
        setRenaming(resp.id);
      }, 150);
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
      setExpand(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
      evt.refreshTree();
      setSelectedId(resp.id);
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
      evt.showSuccessMessage(t("common.deleted"));
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

    {/** ツリースクロールエリア（MoreVert ボタンをフローティングで右上に配置） */}
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div id="treeScrollArea" onContextMenu={(e) => { e.preventDefault(); openMoreMenuAt(e.clientX, e.clientY); }}>
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
        renaming={renaming}
        renamingValue={renamingValue}
        onRenameChange={setRenamingValue}
        onRenameCommit={handleRenameCommit}
        onRenameCancel={handleRenameCancel}
      /></div>
      </div>

      {/** MoreVert フローティングボタン（右上固定） */}
      <Tooltip title={t("tree.menu")} placement="bottom">
        <IconButton
          size="small"
          onClick={(e) => openMoreMenuEl(e.currentTarget)}
          sx={{
            position: 'absolute', top: 4, right: 4, zIndex: 10,
            padding: '5px 0px',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-panel)',
            '&:hover': { color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' },
          }}
        >
          <MoreVertIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Tooltip>
    </div>

    {/** MoreVert ドロップダウンメニュー（ボタンクリック・エリア右クリック共用） */}
    <Menu
      open={moreMenu.open}
      anchorEl={moreMenu.el ?? undefined}
      anchorReference={moreMenu.el ? 'anchorEl' : 'anchorPosition'}
      anchorPosition={moreMenu.el ? undefined : { top: moreMenu.y, left: moreMenu.x }}
      anchorOrigin={{ vertical: 'bottom', horizontal: moreMenu.el ? 'right' : 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: moreMenu.el ? 'right' : 'left' }}
      onClose={closeMoreMenu}
      slotProps={{ paper: { sx: { minWidth: 160 } } }}
    >
      {/** None: ステータス非表示 */}
      <MenuItem onClick={() => { setDisplayMode('none'); closeMoreMenu(); }}>
        {displayMode === 'none'
          ? <RadioButtonCheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />}
        {t("tree.none")}
      </MenuItem>
      {/** Commit: 未コミット表示 */}
      <MenuItem onClick={() => { setDisplayMode('commit'); closeMoreMenu(); }}>
        {displayMode === 'commit'
          ? <RadioButtonCheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />}
        {t("tree.commit")}
      </MenuItem>
      {/** Publish: 未公開表示 */}
      <MenuItem onClick={() => { setDisplayMode('publish'); closeMoreMenu(); }}>
        {displayMode === 'publish'
          ? <RadioButtonCheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />}
        {t("tree.publish")}
      </MenuItem>
      <Divider />
      {/** すべて展開 */}
      <MenuItem onClick={() => { closeMoreMenu(); setExpand(collectExpandableIds(treeRef.current)); }}>
        <UnfoldMoreIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.expandAll")}
      </MenuItem>
      {/** すべて閉じる */}
      <MenuItem onClick={() => { closeMoreMenu(); setExpand(["index"]); }}>
        <UnfoldLessIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.collapseAll")}
      </MenuItem>
      <Divider />
      {/** ブラウザで開く */}
      <MenuItem onClick={() => { closeMoreMenu(); Browser.OpenURL(siteUrl); }}>
        <OpenInBrowserIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.openBrowser")}
      </MenuItem>
      {/** ダウンロード */}
      <MenuItem onClick={(e) => { setDownloadMenuAnchor(e.currentTarget); }}>
        <DownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.download")}
      </MenuItem>
      <Divider />
      {/** ブランチ変更 */}
      <MenuItem onClick={() => { closeMoreMenu(); evt.openBranchModal(); }}>
        <AccountTreeIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.changeBranch")}
      </MenuItem>
      {/** 全体の履歴 */}
      <MenuItem onClick={() => { closeMoreMenu(); OpenOverallHistoryWindow(""); }}>
        <HistoryIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.overallHistory")}
      </MenuItem>
      <Divider />
      {/** リモートにPush */}
      <MenuItem onClick={() => { closeMoreMenu(); evt.openPushModal(); }}>
        <CloudUploadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.pushRemote")}
      </MenuItem>
      {/** リモートからマージ */}
      <MenuItem onClick={() => { closeMoreMenu(); evt.openMergeModal(); }}>
        <CloudDownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.mergeRemote")}
      </MenuItem>
    </Menu>

    {/** ダウンロードサブメニュー: 全体 / docs */}
    <Menu
      open={Boolean(downloadMenuAnchor)}
      onClose={() => { setDownloadMenuAnchor(null); closeMoreMenu(); }}
      anchorEl={downloadMenuAnchor}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { minWidth: 120 } } }}
    >
      <MenuItem onClick={() => { setDownloadMenuAnchor(null); closeMoreMenu(); DownloadAll(); }}>
        {t("tree.downloadAll")}
      </MenuItem>
      <MenuItem onClick={() => { setDownloadMenuAnchor(null); closeMoreMenu(); DownloadDocs(); }}>
        {t("tree.downloadDocs")}
      </MenuItem>
    </Menu>

    {/** ノートメニュー: Edit / Add ▶ / History / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "note"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleRenameStart} divider>{t("common.rename")}</MenuItem>
      <MenuItem onClick={handleEditNote} divider>{t("common.edit")}</MenuItem>
      <MenuItem onClick={handleAddMenuOpen} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t("common.add")}</span><span>▶</span>
      </MenuItem>
      <MenuItem onClick={handleHistoryNote} divider>{t("common.history")}</MenuItem>
      <MenuItem onClick={handleCopyMenuOpen} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t("tree.copy")}</span><span>▶</span>
      </MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: 'var(--accent-red)' }}>{t("common.delete")}</MenuItem>
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
      <MenuItem onClick={handleRegisterNote}>{t("tree.note")}</MenuItem>
      <MenuItem onClick={handleRegisterDiagram}>{t("tree.diagram")}</MenuItem>
      <MenuItem onClick={handleRegisterAssets}>{t("tree.assets")}</MenuItem>
    </Menu>

    {/** Copy サブメニュー: ID / パス */}
    <Menu
      open={Boolean(copyMenuAnchor)}
      onClose={closeAllMenus}
      anchorEl={copyMenuAnchor}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { minWidth: 120 } } }}
    >
      <MenuItem onClick={handleCopyId}>{t("tree.copy.id")}</MenuItem>
      <MenuItem onClick={handleCopyPath}>{t("tree.copy.path")}</MenuItem>
      {showGitBashPath && (
        <MenuItem onClick={handleCopyGitBashPath}>{t("tree.copy.gitbashPath")}</MenuItem>
      )}
    </Menu>

    {/** ダイアグラムメニュー: Edit / History / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "diagram"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleRenameStart} divider>{t("common.rename")}</MenuItem>
      <MenuItem onClick={handleEditDiagram} divider>{t("common.edit")}</MenuItem>
      <MenuItem onClick={handleHistoryDiagram} divider>{t("common.history")}</MenuItem>
      <MenuItem onClick={handleCopyMenuOpen} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t("tree.copy")}</span><span>▶</span>
      </MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: 'var(--accent-red)' }}>{t("common.delete")}</MenuItem>
    </Menu>

    {/** アセットメニュー: Edit / Delete */}
    <Menu
      open={contextMenu.open && contextNodeType === "asset"}
      onClose={closeAllMenus}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{ paper: { sx: { minWidth: 150 } } }}
    >
      <MenuItem onClick={handleRenameStart} divider>{t("common.rename")}</MenuItem>
      <MenuItem onClick={handleEditAsset} divider>{t("common.edit")}</MenuItem>
      <MenuItem onClick={handleCopyMenuOpen} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t("tree.copy")}</span><span>▶</span>
      </MenuItem>
      <MenuItem onClick={handleDeleteRequest} sx={{ color: 'var(--accent-red)' }}>{t("common.delete")}</MenuItem>
    </Menu>

    {/** 削除確認ダイアログ */}
    <Dialog open={deleteConfirm.open} onClose={handleDeleteCancel}>
      <DialogTitle>
        {t("tree.deleteConfirm", { name: deleteConfirm.node?.name })}
      </DialogTitle>
      <DialogActions>
        <Button onClick={handleDeleteCancel}>{t("common.cancel")}</Button>
        <Button onClick={handleDeleteConfirm} color="error" variant="contained">{t("common.delete")}</Button>
      </DialogActions>
    </Dialog>

    {/** メタ編集ダイアログ */}
    <NoteMetaDialog
      open={editDialog.open && editDialog.type === 'note'}
      id={editDialog.id}
      onClose={closeEditDialog}
    />
    <DiagramMetaDialog
      open={editDialog.open && editDialog.type === 'diagram'}
      id={editDialog.id}
      onClose={closeEditDialog}
    />
    <AssetMetaDialog
      open={editDialog.open && editDialog.type === 'asset'}
      id={editDialog.id}
      onClose={closeEditDialog}
    />

  </>);
}

export default BinderTree;
