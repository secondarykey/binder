import { useEffect, useState ,useContext} from "react";
import { useNavigate } from "react-router";

import { CreateRemoteBinder, GetGit } from "../../bindings/binder/api/app";
import { SelectDirectory} from "../../bindings/main/window";
import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import FolderIcon from '@mui/icons-material/Folder';

import Event,{EventContext} from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * Binderリモート作成
 * @param {*} props
 * @returns
 */
function BinderRemote(props) {

  const evt = useContext(EventContext)
  const nav = useNavigate();
  const {t} = useTranslation();

  const [remote, setRemote] = useState("");
  const [dir, setDir] = useState("");
  const [branch, setBranch] = useState("");
  const [workBranch, setWorkBranch] = useState("");
  const [gitName, setGitName] = useState("");
  const [gitMail, setGitMail] = useState("");

  useEffect( () => {
    evt.changeTitle("Remote Import");
    GetGit().then((git) => {
      setWorkBranch(git.workBranch || "");
      setGitName(git.name || "");
      setGitMail(git.mail || "");
    });
  },[])

  //保存
  const handleSave = () => {

    if ( remote == "" ) {
      evt.showWarningMessage("input remote URL");
      return;
      }

    if ( dir == "" ) {
      evt.showWarningMessage("choose directory");
      return;
    }

    CreateRemoteBinder(remote, dir, branch, workBranch, gitName, gitMail).then(() => {

      //TODO アドレス変更通知

      //開く
      nav("/binder/");

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
      evt.showErrorMessage(err)
    });
  }

  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Repository(URL)</FormLabel>
        <TextField value={remote} onChange={(e) => setRemote(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Binder Directory</FormLabel>
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

      {/** クローン対象ブランチ */}
      <FormControl>
        <FormLabel>{t("binderRemote.remoteBranch")}</FormLabel>
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
        <Button variant="contained" onClick={handleSave}>
          <> Create </>
        </Button>
      </FormControl>
    </Grid>
  </>);
}
export default BinderRemote;
