
import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { SelectDirectory,LoadBinder } from '../../wailsjs/go/api/App';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { Download } from '@mui/icons-material';
function FileMenu(props) {

  const viewSetting = () => {
    props.onChangeMode("setting");
  }

  const createBinder = () => {
    props.onChangeMode("registerBinder")
  }

  const importLocal = () => {

    SelectDirectory(false).then( (p) => {

      if ( p == "" ) return;

      LoadBinder(p).then(() => {
        props.onChangeMode("loadBinder")
      }).catch( (err) => {
        console.warn(err);
        props.onMessage("error",err);
      })

    }).catch( (err)=> {
      console.warn(err);
      props.onMessage("error",err);
    })
  }

  return (<>
    <MenuList id="fileMenu">

      <MenuItem onClick={createBinder}>
        <ListItemIcon>
          <CreateNewFolderIcon />
        </ListItemIcon>
        <ListItemText>New</ListItemText>
      </MenuItem>

      <MenuItem onClick={importLocal}>
        <ListItemIcon>
          <FolderOpenIcon />
        </ListItemIcon>
        <ListItemText>Open</ListItemText>
      </MenuItem>

      <MenuItem>
        <ListItemIcon>
          <DownloadIcon />
        </ListItemIcon>
        <ListItemText>Remote Import</ListItemText>
      </MenuItem>

      <MenuItem id="settingMenu" onClick={viewSetting}>
        <ListItemIcon>
          <SettingsIcon />
        </ListItemIcon>
        <ListItemText>Setting</ListItemText>
      </MenuItem>

    </MenuList>
  </>);
}
export default FileMenu;