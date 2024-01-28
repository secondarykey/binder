
import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

function FileMenu(props) {

  const viewSetting = () => {
    props.onChangeMode("setting");
  }

  return (<>
    <MenuList id="fileMenu">

      <MenuItem>
        <ListItemIcon> </ListItemIcon>
        <ListItemText>New</ListItemText>
      </MenuItem>

      <MenuItem>
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