import { useEffect, useState } from "react";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormLabel, Grid, InputAdornment, MenuItem, Select, TextField } from "@mui/material";
import { GetConfig, EditConfig, Remotes, AddRemote } from "../../wailsjs/go/api/App";

import {useLocation, useNavigate} from "react-router-dom";
import CloudIcon from '@mui/icons-material/Cloud';

import Event from "../Event";
import Message from '../Message';

/**
 * バインダーのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Binder(props) {

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [listNum, setListNum] = useState(0);

  const [remote, setRemote] = useState("origin");
  const [remoteList, setRemoteList] = useState([]);

  const [branch, setBranch] = useState("main");
  const [auto, setAuto] = useState(0);

  const [remoteDialog, showRemoteDialog] = useState(false);
  const [remoteName, setRemoteName] = useState("");
  const [remoteURL, setRemoteURL] = useState("");
  
  const getRemoteList = () => {
    Remotes().then((res) => {
      setRemoteList(res);
    }).catch((err) => {
      Message.showError(err);
    });
  }

  useEffect(() => {
    Event.changeTitle("Edit Binder");

    GetConfig().then((conf) => {

      setName(conf.name);
      setDetail(conf.detail);
      setListNum(conf.listNum);
      setRemote(conf.remote);
      setBranch(conf.branch);
      setAuto(conf.autoCommit);
    }).catch((err) => {
      Message.showError(err);
    });
    getRemoteList();
  }, []);

  const handleSave = () => {
    var config = {};
    config.name = name;
    config.detail = detail;
    config.listNum = Number(listNum);
    config.remote = remote;
    config.branch = branch;
    config.autoCommit = Number(auto);
    EditConfig(config).then((resp) => {
      Event.changeBinderTitle(name);
      Message.showSuccess("update binder.");
    }).catch((err) => {
      Message.showError(err);
    });
  }

  const setNumeric = (oldV, newV, caller) => {
    var res = Number(newV)

    console.log(res)
    if (isNaN(res)) {
      res = Number(oldV)
    }
    caller(res);
  }

  const createRemoteDialog = () => {
    console.log(remoteList)
    if ( remoteList.length === 0 ) {
      setRemoteName(remote);
    }
    showRemoteDialog(true);
  }

  const handleDialogClose = () => {
    showRemoteDialog(false);
  }

  const handleChangeRemote = (e,name) => {
    var val = name;
    if ( name === undefined ) {
      val = e.target.value;
    }
    setRemote(val);
  }

  return (<>
    <Grid className="formGrid">

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>{"List Num(= 0 is no limit)"}</FormLabel>
        <TextField value={listNum} onChange={(e) => setNumeric(listNum, e.target.value, setListNum)}>
        </TextField>
      </FormControl>

      <FormControl>
        <FormLabel>{"Auto Commit(= 0 is manual)"}</FormLabel>
        <TextField value={auto} onChange={(e) => setNumeric(auto, e.target.value, setAuto)}>
        </TextField>
      </FormControl>

      <FormControl>
        <FormLabel>
          Remote Name
          <Button onClick={createRemoteDialog}>Add</Button>
        </FormLabel>
        <Select labelId="select-remote"
                label="remote"
                value={remote}
                onChange={(e) => handleChangeRemote(e)}>
{remoteList.map((v) => {
          return ( <MenuItem key={"Select" + v}value={v}>{v}</MenuItem>)
})}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Branch Name(It is only used for PR Links will not be updated.)</FormLabel>
        <TextField value={branch} onChange={(e) => setBranch(e.target.value)}></TextField>
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </FormControl>

    </Grid>

    <Dialog
      open={remoteDialog} onClose={handleDialogClose}
      PaperProps={{
        component: 'form',
        onSubmit: (event) => {
          event.preventDefault();
          AddRemote(remoteName,remoteURL).then(() =>{
            getRemoteList();
            handleChangeRemote(undefined,remoteName);
            handleDialogClose();
          }).catch((err) => {
            Message.showError(err);
          });
        },
        style: {
          backgroundColor: "#333333",
        },
      }}
    >
      <DialogTitle style={{ color: "#eeeeee" }}>Setting Remote</DialogTitle>

      <DialogContent>

        <DialogContentText style={{ color: "#eeeeee" }}>
          You can add, but please use git to edit.
        </DialogContentText>

        <TextField
          required margin="dense" label="Remote Name"
          value={remoteName}
          onChange={(e) => setRemoteName(e.target.value)}
          fullWidth variant="standard"
        />
        <TextField
          autoFocus required margin="dense" label="Remote URL"
          value={remoteURL}
          onChange={(e) => setRemoteURL(e.target.value)}
          fullWidth variant="standard"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDialogClose}>Cancel</Button>
        <Button type="submit">Set</Button>
      </DialogActions>
    </Dialog>


  </>);
}
export default Binder;