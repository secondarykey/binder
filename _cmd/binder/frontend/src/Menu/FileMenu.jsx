
import {  ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

function FileMenu(props) {
    return (<>
      <MenuList>
        <MenuItem>
          <ListItemIcon> </ListItemIcon>
          <ListItemText>New</ListItemText>
        </MenuItem>

        <MenuItem>
          <ListItemIcon> </ListItemIcon>
          <ListItemText>Load(Local)</ListItemText>
        </MenuItem>

        <MenuItem>
          <ListItemIcon> </ListItemIcon>
          <ListItemText>Load(Remote)</ListItemText>
        </MenuItem>

        <MenuItem>
          <ListItemIcon> </ListItemIcon>
          <ListItemText>Convert</ListItemText>
        </MenuItem>
      </MenuList>
    </>);
}
export default FileMenu;