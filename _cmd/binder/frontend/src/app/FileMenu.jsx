import { useContext } from 'react';
import { useNavigate } from 'react-router';

import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { SelectDirectory } from '../../bindings/main/window';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import Event,{EventContext} from '../Event';

/**
 * Binderを開く画面
 * @param {*} props
 * @returns
 */
function FileMenu(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();

  const handleNew = () => {
    nav("/file/new");
  }

  const remoteBinder = () => {
    nav("/file/remote");
  }

  const handleOpen = () => {

    SelectDirectory(false).then( (p) => {

      if ( p == "" ) return;

      evt.openBinder(p);

    }).catch( (err)=> {
      evt.showErrorMessage(err);
    })

  }

  return (<>

    <MenuList id="fileMenu">

      <MenuItem onClick={handleNew}>
        <ListItemIcon>
          <CreateNewFolderIcon />
        </ListItemIcon>
        <ListItemText>New</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleOpen}>
        <ListItemIcon>
          <FolderOpenIcon />
        </ListItemIcon>
        <ListItemText>Open</ListItemText>
      </MenuItem>
      <MenuItem onClick={remoteBinder}>
        <ListItemIcon>
          <DownloadIcon />
        </ListItemIcon>
        <ListItemText>Remote Import</ListItemText>
      </MenuItem>

    </MenuList>
  </>);
}
export default FileMenu;
