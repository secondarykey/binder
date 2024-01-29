
import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { CreateBinder,LoadBinder } from '../../wailsjs/go/api/App';
function FileMenu(props) {

  const viewSetting = () => {
    props.onChangeMode("setting");
  }

  const createBinder = () => {
    //TODO 実際は画面変更
    CreateBinder("","simple",true).then(() => {

    }).catch( (err)=> {
      console.warn(err);
      props.onMessage("error",err);
    })

  }

  const importLocal = () => {
    LoadBinder().then(() => {
      props.onChangeMode("loadBinder")
    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error",err);
    })
  }

  return (<>
    <MenuList id="fileMenu">

      <MenuItem onClick={createBinder}>
        <ListItemIcon> </ListItemIcon>
        <ListItemText>New</ListItemText>
      </MenuItem>

      <MenuItem onClick={importLocal}>
        <ListItemIcon> </ListItemIcon>
        <ListItemText>Local Import</ListItemText>
      </MenuItem>

      <MenuItem>
        <ListItemIcon> </ListItemIcon>
        <ListItemText>Remote Import</ListItemText>
      </MenuItem>

      <MenuItem id="settingMenu" onClick={viewSetting}>
        <ListItemIcon> </ListItemIcon>
        <ListItemText>Setting</ListItemText>
      </MenuItem>

    </MenuList>
  </>);
}
export default FileMenu;