import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';

import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { SelectDirectory,LoadBinder } from '../../../wailsjs/go/api/App';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import Event,{EventContext} from '../../Event';

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
    //props.onChangeMode("remoteBinder")
  }

  const handleOpen = () => {

    SelectDirectory(false).then( (p) => {
      if ( p == "" ) return;
      LoadBinder(p).then((href) => {

        evt.changeAddress(href);

        nav("/note/edit/index");
      }).catch( (err) => {
        evt.showErrorMessage(err);
      })

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