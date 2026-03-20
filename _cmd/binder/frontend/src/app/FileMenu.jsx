import { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { ListItemIcon, ListItemText, MenuItem, MenuList } from '@mui/material';

import { SelectDirectory } from '../../bindings/main/window';
import { CheckConvert, Convert, LoadBinder } from '../../bindings/binder/api/app';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import "../../i18n/config";
import { useTranslation } from 'react-i18next';

import Event,{EventContext} from '../Event';
import ConvertDialog from '../dialogs/components/ConvertDialog';

/**
 * Binderを開く画面
 * @param {*} props
 * @returns
 */
function FileMenu(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const {t} = useTranslation();

  const [convertOpen, setConvertOpen] = useState(false);
  const [pendingDir, setPendingDir] = useState("");

  const handleNew = () => {
    nav("/file/new");
  }

  const remoteBinder = () => {
    //props.onChangeMode("remoteBinder")
  }

  const openBinder = (dir) => {
    LoadBinder(dir).then((href) => {
      evt.changeAddress(href);
      nav("/note/edit/index");
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  }

  const handleOpen = () => {

    SelectDirectory(false).then( (p) => {

      if ( p == "" ) return;

      CheckConvert(p).then((needsConvert) => {
        if (needsConvert) {
          setPendingDir(p);
          setConvertOpen(true);
        } else {
          openBinder(p);
        }
      }).catch((err) => {
        evt.showErrorMessage(err);
      })

    }).catch( (err)=> {
      evt.showErrorMessage(err);
    })

  }

  const handleConvertConfirm = () => {
    setConvertOpen(false);
    const dir = pendingDir;
    setPendingDir("");

    Convert(dir).then(() => {
      evt.showSuccessMessage(t("convert.success"));
      openBinder(dir);
    }).catch((err) => {
      evt.showErrorMessage(t("convert.error", { error: err }));
    })
  }

  const handleConvertCancel = () => {
    setConvertOpen(false);
    setPendingDir("");
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

    <ConvertDialog
      open={convertOpen}
      onCancel={handleConvertCancel}
      onConfirm={handleConvertConfirm}
    />
  </>);
}
export default FileMenu;
