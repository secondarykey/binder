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
        dataId : undefined,
        assets : undefined
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

    const showMenu = (e,call,noteId,dataId,assets) => {
      e.preventDefault();
      call(e.target);
      e.stopPropagation();
      currentId.noteId = noteId;
      currentId.dataId = dataId;
      currentId.assets = assets;
    }

    const closeMenu = (call) => {
      currentId.noteId = undefined;
      currentId.dataId = undefined;
      currentId.assets = undefined;
      call(null);
    };

    //ノート作成
    const handleCreateNote = () => {
      props.onChangeMode("note","");
      closeMenu(setNoteRootEl);
    }

    //データ作成
    const handleCreateData = () => {
      props.onChangeMode("data","","");
      closeMenu(setDataRootEl);
    }

    //ノートを開く処理
    const handleNoteOpen = (n) => {
      props.onChangeMode("editor",n.ID);
    }

    //データを開く処理
    const handleDataOpen = (d) => {
      props.onChangeMode("editor",d.ID,d.NoteId);
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
        <TreeItem nodeId="Notes" label="Notes">
          {notes.map( (n) => {
            //n.Data から assets データを設定
            var assets = [];
            var data = [];
            return (
              <TreeItem nodeId={n.ID} label={n.Title} 
                        onDoubleClick={() => handleNoteOpen(n)}
                        onContextMenu={(e) =>showMenu(e,setNoteEl,n.ID)}>

                <TreeItem nodeId={n.ID + "Assets"} label="Assets" 
                          onContextMenu={(e) =>showMenu(e,setAssetRootEl,n.ID,"",true)}>
                  {assets.map( (d) => {
                    return (<>
                      <TreeItem nodeId={d.NoteID + "/" + d.ID} label={d.Name}
                                onContextMenu={(e) =>showMenu(e,setDataEl,d.NoteID,d.ID,true)}/>
                    </>);
                  })}
                </TreeItem>
                {data.map( (d) => {
                    return (<>
                      <TreeItem nodeId={d.NoteID + "/" + d.ID} label={d.Name} 
                                onDoubleClick={() => handleDataOpen(d)}
                                onContextMenu={(e) =>showMenu(e,setDataEl,d.NoteID,dID,false)}/>
                    </>);
                })}
              </TreeItem>
            );
          })}
        </TreeItem>

        {/** データの表示 */}
        <TreeItem nodeId="Data" label="Data" 
                  onContextMenu={(e) => showMenu(e,setDataRootEl,"","",true)}>
          <TreeItem nodeId="Assets" label="Assets"
                    onContextMenu={(e) => showMenu(e,setAssetRootEl,"","",true)}>
            {dataAssets.map( (d) => {
              return (<>
                <TreeItem nodeId={d.ID} label={d.Name}
                          onContextMenu={(e) =>showMenu(e,setDataEl,"",d.ID,true)}/>
              </>);
            })}
          </TreeItem>
          {dataText.map( (d) => {
            return (<>
              <TreeItem nodeId={d.ID} label={d.Name} 
                        onDoubleClick={() => handleDataOpen(d)}
                        onContextMenu={(e) =>showMenu(e,setDataEl,"",d.ID,false)}/>
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
          onClose={setNoteRootEl}>

      <MenuItem onClick={handleCreateNote}>Create Note</MenuItem>

    </Menu>

    {/** ノート個別のメニュー 
      編集 -> IDの変更、ノート削除
      アセットの追加
      データテキストの追加
      */}
    <Menu anchorEl={noteEl}
          open={noteMenu}
          onClose={() => closeMenu(setNoteEl)}>
      <MenuItem onClick={handleCreateNote}>Edit</MenuItem>
      <MenuItem onClick={handleCreateData}>Import Assets</MenuItem>
      <MenuItem onClick={handleCreateData}>Add Data</MenuItem>
    </Menu>

    {/** データのメニュー 
        - アセットの追加
        - データテキストの追加
      */}
    <Menu anchorEl={dataRootEl}
          open={dataRootMenu}
          onClose={() => closeMenu(setDataRootEl)}>
      <MenuItem onClick={handleCreateData}>Import Assets</MenuItem>
      <MenuItem onClick={handleCreateData}>Add Data</MenuItem>
    </Menu>

    {/** データ個別のメニュー 
      編集 -> IDの変更 削除 (アセットの場合、変更？)
      */}
    <Menu anchorEl={dataEl}
          open={dataMenu}
          onClose={() => closeMenu(setDataEl)}>
      <MenuItem onClick={handleCreateNote}>Edit</MenuItem>
    </Menu>

    {/** アセットのメニュー */}
    <Menu anchorEl={assetRootEl}
          open={assetRootMenu}
          onClose={() => closeMenu(setAssetRootEl)}>
      <MenuItem onClick={handleCreateData}>Import</MenuItem>
    </Menu>

    {/** テンプレートのメニューはなし？ */}
    </>);
}
export default BinderTree;