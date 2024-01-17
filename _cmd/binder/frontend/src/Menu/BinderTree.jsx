import { useState,useEffect } from 'react';

import { Menu,MenuItem } from '@mui/material';
import { TreeView,TreeItem } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon  from '@mui/icons-material/ChevronRight';

import { GetResource } from '../../wailsjs/go/main/App';

function BinderTree(props) {

    ExpandMoreIcon

    const [notes, setNotes] = useState([]);
    const [data, setData] = useState([]);

    var currentId = {
        noteId : undefined,
        dataId : undefined
    }

    const [ids, setCurrentId] = useState(currentId);
    const setIds = (nId,dId) => {
      var idObj = {
        noteId : nId,
        dataId : dId
      }
      setCurrentId(idObj)
    }

    //リソースを作成
    const viewResource = () => {
      GetResource().then( (resp) => {
        setNotes(resp.Notes);
        setData(resp.Data);
      }).catch( (err) => {
        console.log(err);
      });
    }

    useEffect(() => {
      viewResource();
    },[])

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

    const showMenu = (e,call,noteId,dataId) => {
      e.preventDefault();
      call(e.target);
      e.stopPropagation();
     
      setIds(noteId,dataId);
    }

    const closeMenu = (call) => {
      setIds(undefined,undefined);
      call(null);
    };

    //ノート作成
    const handleEditNote = (call) => {
      props.onChangeMode("note",ids.noteId);
      closeMenu(call);
    }

    //データ作成
    const handleEditData = (call) => {
      props.onChangeMode("data",ids.dataId,ids.noteId);
      closeMenu(call);
    }

    const handleEditAssets = (call) => {
      props.onChangeMode("assets",ids.dataId,ids.noteId);
      closeMenu(call);
    }

    //ノートを開く処理
    const handleNoteOpen = (e,n) => {
      props.onChangeMode("editor",n.ID);
      e.stopPropagation();
    }

    //データを開く処理
    const handleDataOpen = (e,d) => {
      props.onChangeMode("editor",d.ID,d.NoteId);
      e.stopPropagation();
    }

    //データを設定
    var dataAssets = [];
    var dataText = [];

    data.map( (v) => {
      if ( v.PluginId == "assets" ) {
        dataAssets.push(v);
      } else {
        dataText.push(v);
      }
    })

    return (<>
      <TreeView className='treeText'
                aria-label="binder system navigator"
                defaultCollapseIcon={<ExpandMoreIcon />}
                defaultExpandIcon={<ChevronRightIcon />} >

        {/** ノートの表示 */}
        <TreeItem nodeId="Notes" label="Notes"
                  onContextMenu={(e) =>showMenu(e,setNoteRootEl,"","")}>
          {notes.map( (n) => {
            //n.Data から assets データを設定
            var assets = [];
            var data = [];
            if ( n.Data !== null ) {
              n.Data.map( (v) => {
                if ( v.PluginId == "assets" ) {
                  assets.push(v);
                } else {
                  data.push(v);
                }
              });
            }
            return (
              <TreeItem nodeId={n.ID} label={n.Title} 
                        onDoubleClick={(e) => handleNoteOpen(e,n)}
                        onContextMenu={(e) =>showMenu(e,setNoteEl,n.ID)}>

                <TreeItem nodeId={n.ID + "Assets"} label="Assets" 
                          onContextMenu={(e) =>showMenu(e,setAssetRootEl,n.ID,"")}>
                  {assets.map( (d) => {
                    return (<>
                      <TreeItem nodeId={d.NoteID + "/" + d.ID} label={d.Name}
                                onContextMenu={(e) =>showMenu(e,setDataEl,d.NoteID,d.ID)}/>
                    </>);
                  })}
                </TreeItem>
                {data.map( (d) => {
                    return (<>
                      <TreeItem nodeId={d.NoteID + "/" + d.ID} label={d.Name} 
                                onDoubleClick={(e) => handleDataOpen(e,d)}
                                onContextMenu={(e) =>showMenu(e,setDataEl,d.NoteID,dID)}/>
                    </>);
                })}
              </TreeItem>
            );
          })}
        </TreeItem>

        {/** データの表示 */}
        <TreeItem nodeId="Data" label="Data" 
                  onContextMenu={(e) => showMenu(e,setDataRootEl,"","")}>
          <TreeItem nodeId="Assets" label="Assets"
                    onContextMenu={(e) => showMenu(e,setAssetRootEl,"","")}>
            {dataAssets.map( (d) => {
              return (<>
                <TreeItem nodeId={d.ID} label={d.Name}
                          onContextMenu={(e) =>showMenu(e,setDataEl,"",d.ID)}/>
              </>);
            })}
          </TreeItem>
          {dataText.map( (d) => {
            return (<>
              <TreeItem nodeId={d.ID} label={d.Name} 
                        onDoubleClick={(e) => handleDataOpen(e,d)}
                        onContextMenu={(e) =>showMenu(e,setDataEl,"",d.ID)}/>
            </>);
          })}
        </TreeItem>

        {/** テンプレートの表示 */}
        <TreeItem nodeId="Templates" label="Templates">
          <TreeItem nodeId="layout" label="Layout" />
          <TreeItem nodeId="index" label="Home" />
          <TreeItem nodeId="list" label="PageList" />
          <TreeItem nodeId="note" label="Note" />
        </TreeItem>

      </TreeView>

    {/** 以下ツリー用のメニュ－ */}

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

    {/** テンプレートのメニューはなし？ */}
    </>);
}
export default BinderTree;