import { useState, useEffect } from 'react';

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

import BinderIcon from "../assets/images/binder.svg";

import { GetResource } from '../../wailsjs/go/api/App';

function BinderRootIcon() {
  return <img src={BinderIcon} width="24" height="24"/>;
}

function BinderTree(props) {

  const [notes, setNotes] = useState([]);
  const [data, setData] = useState([]);

  var currentId = {
    noteId: undefined,
    dataId: undefined
  }

  const [ids, setCurrentId] = useState(currentId);
  const setIds = (nId, dId) => {
    var idObj = {
      noteId: nId,
      dataId: dId
    }
    setCurrentId(idObj)
  }

  //リソースを作成
  const viewResource = () => {
    GetResource().then((resp) => {
      setNotes(resp.notes);
      setData(resp.data);
    }).catch((err) => {
      console.warn(err);
      props.onMessage("error", err);
    });
  }

  useEffect(() => {

    viewResource();

    //TODO 戻り値などで選択状態かを判定

  }, [props.redraw])

  const [binderEl, setBinder] = useState(null);
  const binderMenu = Boolean(binderEl);
  const [noteRootEl, setNoteRootEl] = useState(null);
  const noteRootMenu = Boolean(noteRootEl);
  const [noteEl, setNoteEl] = useState(null);
  const noteMenu = Boolean(noteEl);
  const [dataRootEl, setDataRootEl] = useState(null);
  const dataRootMenu = Boolean(dataRootEl);
  const [dataEl, setDataEl] = useState(null);
  const dataMenu = Boolean(dataEl);
  const [assetRootEl, setAssetRootEl] = useState(null);
  const assetRootMenu = Boolean(assetRootEl);
  const [assetEl, setAssetEl] = useState(null);
  const assetMenu = Boolean(assetEl);

  //メニュー表示
  const showMenu = (e, call, noteId, dataId) => {
    e.preventDefault();
    call(e.target);
    e.stopPropagation();

    setIds(noteId, dataId);
  }

  //メニューを閉じる
  const closeMenu = (call) => {
    setIds(undefined, undefined);
    call(null);
  };

  //ノート作成
  const handleEditBinder = (call) => {
    props.onChangeMode("binder");
    closeMenu(call);
  }

  //ノート作成
  const handleEditNote = (call) => {
    props.onChangeMode("note", ids.noteId);
    closeMenu(call);
  }

  //データ作成
  const handleEditData = (call) => {
    props.onChangeMode("data", ids.dataId, ids.noteId);
    closeMenu(call);
  }
  //Assets の作成
  const handleEditAssets = (call) => {
    props.onChangeMode("assets", ids.dataId, ids.noteId);
    closeMenu(call);
  }

  //ノートを開く処理
  const handleNoteOpen = (e, n) => {
    props.onChangeMode("editor", n.id);
    e.stopPropagation();
  }

  //データを開く処理
  const handleDataOpen = (e, d) => {
    props.onChangeMode("editor", d.id, d.noteId);
    e.stopPropagation();
  }

  //テンプレートを開く処理
  const handleTemplateOpen = (e, id) => {
    props.onChangeMode("template", id);
    e.stopPropagation();
  }

  //なし(親の反応をしないように設定)
  const doNothing = (e) => {
    e.preventDefault();
    e.stopPropagation();
  }

  //データを設定
  var dataAssets = [];
  var dataText = [];

  data.map((v) => {
    if (v.pluginId == "assets") {
      dataAssets.push(v);
    } else {
      dataText.push(v);
    }
  })

  return (<>
    {/** Binderの表示 */}
    <TreeView className='treeText'
              defaultExpanded={["Binder","Notes"]}
              defaultSelected={""}
              key={"key"}
              aria-label="binder system navigator">

      {/** ノートの一覧表示 */}
      <TreeItem nodeId="Binder" label="Binder"
        icon={<BinderRootIcon />}
        key="Binder"
        onContextMenu={(e) => showMenu(e, setBinder, "", "")}>

        {/** ノートの一覧表示 */}
        <TreeItem nodeId="Notes" label="Notes"
          key="Notes"
          icon={<LibraryBooksIcon />}
          onContextMenu={(e) => showMenu(e, setNoteRootEl, "", "")}>

          {notes.map((n) => {

            //n.Data から assets データを設定
            var assets = [];
            var data = [];
            if (n.data !== null) {
              n.data.map((v) => {
                if (v.pluginId == "assets") {
                  assets.push(v);
                } else {
                  data.push(v);
                }
              });
            }
            return (<>
              {/** ノートの表示 */}
              <TreeItem key={n.id}
                nodeId={n.id} label={n.name}
                icon={<NoteIcon />}
                onClick={(e) => handleNoteOpen(e, n)}
                onContextMenu={(e) => showMenu(e, setNoteEl, n.id)}>
                {/** Assetsの表示 */}
                <TreeItem nodeId={n.id + "Assets"} label="Assets"
                  key={"assets/" + n.id}
                  icon={<WebAssetIcon />}
                  onClick={doNothing}
                  onContextMenu={(e) => showMenu(e, setAssetRootEl, n.id, "")}>
                  {assets.map((d) => {
                    var key = d.noteId + "/" + d.id;
                    return (<>
                      <TreeItem nodeId={d.noteId + "/" + d.id} label={d.name}
                        key={key}
                        icon={<AttachmentIcon />}
                        onContextMenu={(e) => showMenu(e, setAssetEl, d.noteId, d.id)} />
                    </>);
                  })}
                </TreeItem>

                {/** TextData の表示 */}
                {data.map((d) => {
                  var key = d.noteId + "/" + d.id;
                  return (<>
                    <TreeItem nodeId={key} label={d.name}
                      key={key}
                      icon={<TextSnippetIcon />}
                      onClick={(e) => handleDataOpen(e, d)}
                      onContextMenu={(e) => showMenu(e, setDataEl, d.noteId, d.id)} />
                  </>);
                })}
              </TreeItem>
            </>);
          })}
        </TreeItem>

        {/** データのディレクトリ表示 */}
        <TreeItem nodeId="Data" label="Data"
          key="Data"
          icon={<FolderIcon />}
          onContextMenu={(e) => showMenu(e, setDataRootEl, "", "")}>
          {/** Assetsの表示 */}
          <TreeItem nodeId="Assets" label="Assets"
            icon={<WebAssetIcon />}
            onClick={doNothing}
            onContextMenu={(e) => showMenu(e, setAssetRootEl, "", "")}>
            {/** Assets dataの表示 */}
            {dataAssets.map((d) => {
              var key = "assets/" + d.id;
              return (<>
                <TreeItem nodeId={key} label={d.name}
                  key={key}
                  icon={<AttachmentIcon />}
                  onContextMenu={(e) => showMenu(e, setAssetEl, "", d.id)} />
              </>);
            })}
          </TreeItem>
          {/** TextData の表示 */}
          {dataText.map((d) => {
            var key = "data/" + d.id;
            return (<>
              <TreeItem nodeId={key} label={d.name}
                key={key}
                icon={<TextSnippetIcon />}
                onClick={(e) => handleDataOpen(e, d)}
                onContextMenu={(e) => showMenu(e, setDataEl, "", d.id)} />
            </>);
          })}
        </TreeItem>

        {/** テンプレートの表示 */}
        <TreeItem nodeId="Templates" label="Templates"
          icon={<HtmlIcon />} >
          <TreeItem nodeId="layout" label="Layout"
            onClick={((e) => handleTemplateOpen(e, "layout"))}
            icon={<CodeIcon />} />
          <TreeItem nodeId="index" label="Home"
            onClick={((e) => handleTemplateOpen(e, "index"))}
            icon={<CodeIcon />} />
          <TreeItem nodeId="list" label="NoteList"
            onClick={((e) => handleTemplateOpen(e, "list"))}
            icon={<CodeIcon />} />
          <TreeItem nodeId="note" label="Note"
            onClick={((e) => handleTemplateOpen(e, "note"))}
            icon={<CodeIcon />} />
        </TreeItem>
      </TreeItem>

    </TreeView>

    {/** 以下ツリー用のメニュ－ */}

    <Menu anchorEl={binderEl}
      open={binderMenu}
      onClose={() => closeMenu(setBinder)}>
      <MenuItem onClick={() => handleEditBinder(setBinder)}>Edit</MenuItem>
    </Menu>
    {/** ノート用のメニュー 
         ノートの追加
      */}
    <Menu anchorEl={noteRootEl}
      open={noteRootMenu}
      onClose={() => closeMenu(setNoteRootEl)}>

      <MenuItem onClick={() => handleEditNote(setNoteRootEl)}>Create Note</MenuItem>

    </Menu>

    {/** ノート個別のメニュー 
      編集 -> IDの変更、ノート削除
      アセットの追加
      データテキストの追加
      */}
    <Menu anchorEl={noteEl}
      open={noteMenu}
      onClose={() => closeMenu(setNoteEl)}>
      <MenuItem onClick={() => handleEditNote(setNoteEl)}>Edit</MenuItem>
      <MenuItem onClick={() => handleEditAssets(setNoteEl)}>Import Assets</MenuItem>
      <MenuItem onClick={() => handleEditData(setNoteEl)}>Add Data</MenuItem>
    </Menu>

    {/** データのメニュー 
        - アセットの追加
        - データテキストの追加
      */}
    <Menu anchorEl={dataRootEl}
      open={dataRootMenu}
      onClose={() => closeMenu(setDataRootEl)}>
      <MenuItem onClick={() => handleEditAssets(setDataRootEl)}>Import Assets</MenuItem>
      <MenuItem onClick={() => handleEditData(setDataRootEl)}>Add Data</MenuItem>
    </Menu>

    {/** データ個別のメニュー 
      編集 -> IDの変更 削除 (アセットの場合、変更？)
      */}
    <Menu anchorEl={dataEl}
      open={dataMenu}
      onClose={() => closeMenu(setDataEl)}>
      <MenuItem onClick={() => handleEditData(setDataEl)}>Edit</MenuItem>
    </Menu>

    {/** アセットのメニュー */}
    <Menu anchorEl={assetRootEl}
      open={assetRootMenu}
      onClose={() => closeMenu(setAssetRootEl)}>
      <MenuItem onClick={() => handleEditAssets(setAssetRootEl)}>Import</MenuItem>
    </Menu>

    {/** アセットのメニュー */}
    <Menu anchorEl={assetEl}
      open={assetMenu}
      onClose={() => closeMenu(setAssettEl)}>
      <MenuItem onClick={() => handleEditAssets(setAssetEl)}>Edit</MenuItem>
    </Menu>

    {/** テンプレートのメニューはなし？ */}
  </>);
}
export default BinderTree;