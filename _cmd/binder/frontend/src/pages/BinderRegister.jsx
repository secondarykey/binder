import { useState,useContext } from "react";
import { useNavigate } from "react-router";

import { SelectDirectory } from "../../bindings/main/window";
import { CreateBinder } from "../../bindings/binder/api/app";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

import Event,{EventContext} from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * Binder新規作成
 * @param {*} props 
 * @returns 
 */
function BinderRegister(props) {

  const evt = useContext(EventContext);
  const nav = useNavigate();
  const [dir, setDir] = useState("");
  const {t} = useTranslation();

  //保存
  const handleSave = () => {
    if ( dir == "" ) {
      evt.showWarningMessage(t("binderRegister.requiredDirectory"));
      return;
    }

    //インストールを別にする
    CreateBinder(dir,"simple").then((href) => {

      evt.changeAddress(href);
      //TODO Binder変更通知
      nav("/note/index");

    }).catch( (err)=> {
      evt.showErrorMessage(err);
    })
  }

  const selectDir = () => {
    SelectDirectory(true).then((f) => {
      if (f != "") {
        setDir(f);
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>{t("binderRegister.binderDirectory")}</FormLabel>
        <TextField value={dir} onClick={selectDir}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FolderIcon />
              </InputAdornment>
            )
          }}>
        </TextField>
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {t("common.create")}
        </Button>
      </FormControl>
    </Grid>
  </>);
}
export default BinderRegister;