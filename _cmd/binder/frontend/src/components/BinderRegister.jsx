import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router";

import { SelectDirectory } from "../../bindings/main/window";
import { CreateBinder, GetGit } from "../../bindings/binder/api/app";
import { FormControl, FormLabel, Grid, InputAdornment, TextField, Tooltip, IconButton } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';

import Event,{EventContext} from "../Event";
import { ActionButton } from '../dialogs/components/ActionButton';
import "../language";
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
  const [branch, setBranch] = useState("main");
  const [workBranch, setWorkBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");
  const {t} = useTranslation();

  useEffect(() => {
    GetGit().then((git) => {
      setBranch(git.branch || "main");
      setWorkBranch(git.workBranch || "");
      setGitName(git.name || "");
      setGitMail(git.mail || "");
    });
  }, []);

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

      {/** デフォルトブランチ */}
      <FormControl>
        <FormLabel>{t("setting.defaultBranch")}</FormLabel>
        <TextField size="small" value={branch} onChange={(e) => setBranch(e.target.value)} />
      </FormControl>

      {/** 作業ブランチ */}
      <FormControl>
        <FormLabel>{t("setting.workBranch")}</FormLabel>
        <TextField size="small" value={workBranch} onChange={(e) => setWorkBranch(e.target.value)} />
      </FormControl>

      {/** 名前 */}
      <FormControl>
        <FormLabel>{t("setting.gitName")}</FormLabel>
        <TextField size="small" value={gitName} onChange={(e) => setGitName(e.target.value)} />
      </FormControl>

      {/** メールアドレス */}
      <FormControl>
        <FormLabel>{t("setting.gitMail")}</FormLabel>
        <TextField size="small" value={gitMail} onChange={(e) => setGitMail(e.target.value)} />
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <ActionButton variant="confirm" label={t("common.create")} icon={<AddIcon />} onClick={handleSave} />
      </FormControl>
    </Grid>
  </>);
}
export default BinderRegister;