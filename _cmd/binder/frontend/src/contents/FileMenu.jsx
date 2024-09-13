import { useNavigate } from 'react-router-dom';

import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { SelectDirectory,LoadBinder } from '../../wailsjs/go/api/App';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';

import Event from '../Event';

/**
 * Binderを開く画面
 * @param {*} props 
 * @returns 
 */
function FileMenu(props) {

  const nav = useNavigate();

  const handleNew = () => {
    nav("/file/new");
  }

  const remoteBinder = () => {
    //props.onChangeMode("remoteBinder")
  }

  const handleOpen = () => {

    SelectDirectory(false).then( (p) => {

      if ( p == "" ) return;

      LoadBinder(p).then(() => {
        nav("/note/index");
      }).catch( (err) => {
        console.error(err);
        Event.showErrorMessage(error);
      })

    }).catch( (err)=> {
      console.error(err);
      Event.showErrorMessage(error);
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
{/**
      <MenuItem onClick={remoteBinder}>
        <ListItemIcon>
          <DownloadIcon />
        </ListItemIcon>
        <ListItemText>Remote Import</ListItemText>
      </MenuItem>
 */}

    </MenuList>
  </>);
}
export default FileMenu;