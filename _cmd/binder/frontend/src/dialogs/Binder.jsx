import { useEffect, useState, useContext } from "react";

import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, FormLabel, List, ListItemButton, ListItemText, MenuItem, Select, TextField,
} from "@mui/material";
import { GetConfig, EditConfig, Remotes, AddRemote } from "../../bindings/binder/api/app";

import { EventContext } from "../Event";

const MENU_ITEMS = [
  { key: "basic", label: "基本設定" },
];

/**
 * バインダーのメタデータを表示・編集
 */
function Binder({ isModal, ...props }) {

  const evt = useContext(EventContext);

  const [activeSection, setActiveSection] = useState("basic");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [remote, setRemote] = useState("origin");
  const [remoteList, setRemoteList] = useState([]);
  const [branch, setBranch] = useState("main");

  const [remoteDialog, showRemoteDialog] = useState(false);
  const [remoteName, setRemoteName] = useState("");
  const [remoteURL, setRemoteURL] = useState("");

  const getRemoteList = () => {
    Remotes().then((res) => {
      setRemoteList(res);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  useEffect(() => {
    if (!isModal) evt.changeTitle("Edit Binder");
    GetConfig().then((conf) => {
      setName(conf.name);
      setDetail(conf.detail);
      setRemote(conf.remote);
      setBranch(conf.branch);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    getRemoteList();
  }, []);

  const handleSave = () => {
    const config = {
      name,
      detail,
      remote,
      branch,
    };
    EditConfig(config).then(() => {
      evt.changeBinderTitle(name);
      evt.showSuccessMessage("update binder.");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  const handleChangeRemote = (e, val) => {
    setRemote(val !== undefined ? val : e.target.value);
  };

  const createRemoteDialog = () => {
    if (remoteList.length === 0) setRemoteName(remote);
    showRemoteDialog(true);
  };

  const handleDialogClose = () => showRemoteDialog(false);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>

      {/** 左サイドナビ */}
      <List disablePadding sx={{
        width: 120,
        flexShrink: 0,
        borderRight: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-dialog)',
        pt: 1,
      }}>
        {MENU_ITEMS.map((item) => (
          <ListItemButton
            key={item.key}
            selected={activeSection === item.key}
            onClick={() => setActiveSection(item.key)}
            sx={{
              py: 1,
              px: 1.5,
              '&.Mui-selected': { backgroundColor: 'var(--selected-menu)', color: 'var(--selected-text)' },
              '&.Mui-selected:hover': { backgroundColor: 'var(--selected-menu)' },
              '&:hover': { backgroundColor: 'var(--bg-elevated)' },
            }}
          >
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '13px' }}
            />
          </ListItemButton>
        ))}
      </List>

      {/** 右コンテンツ */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {activeSection === "basic" && (
          <div className="formGrid" style={{ margin: '20px 24px' }}>

            <FormControl>
              <FormLabel>Name</FormLabel>
              <TextField size="small" value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>Detail</FormLabel>
              <TextField size="small" value={detail} onChange={(e) => setDetail(e.target.value)} multiline />
            </FormControl>

            <FormControl>
              <FormLabel>
                Remote Name
                <Button onClick={createRemoteDialog}>Add</Button>
              </FormLabel>
              <Select
                size="small"
                value={remote}
                onChange={(e) => handleChangeRemote(e)}
                sx={{ color: 'var(--text-primary)' }}
                MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
              >
                {remoteList.map((v) => (
                  <MenuItem key={"Select" + v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Branch Name</FormLabel>
              <TextField size="small" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </FormControl>

            <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
              <Button variant="contained" onClick={handleSave}>Save</Button>
            </FormControl>

          </div>
        )}

      </Box>

      {/** リモート追加ダイアログ */}
      <Dialog
        open={remoteDialog}
        onClose={handleDialogClose}
        PaperProps={{
          component: 'form',
          onSubmit: (event) => {
            event.preventDefault();
            AddRemote(remoteName, remoteURL).then(() => {
              getRemoteList();
              handleChangeRemote(undefined, remoteName);
              handleDialogClose();
            }).catch((err) => {
              evt.showErrorMessage(err);
            });
          },
          style: { backgroundColor: "var(--bg-button)" },
        }}
      >
        <DialogTitle style={{ color: "var(--text-secondary)" }}>Setting Remote</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
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

    </Box>
  );
}

export default Binder;
