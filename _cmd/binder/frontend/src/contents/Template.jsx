import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { EditTemplate, GetTemplate } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import ContentCopy from '@mui/icons-material/ContentCopy';

import Event from "../Event";
/**
 * テンプレートの作成、編集を行う
 * @param {*} props 
 * @returns 
 */
function Template(props) {

  const nav = useNavigate();
  const {mode,currentId} = useParams();

  const [id,setId] = useState("");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
  },[]);

  useEffect(() => {

    if ( !currentId ) {
      return;
    }

    setName("");
    setDetail("")

    if ( mode === "register") {
      setId("");
      setType(currentId);
      Event.changeTitle("Register Template");
      return;
    } else {
      setId(currentId)
    }

    GetTemplate(currentId).then((data) => {
      setName(data.name);
      setDetail(data.detail)
      setType(data.type)
      Event.changeTitle("Edit Template:" + data.name);
    }).catch((err) => {
      Event.showErrorMessage(err);
    })
  }, [currentId]);

  //保存
  const handleSave = () => {

    var data = {};
    data.id = id
    data.name = name
    data.detail = detail
    data.type = type

    EditTemplate(data).then((resp) => {
      Event.refreshTree();
      if ( mode === "register" ) {
        nav("/assets/edit/" + resp.id);
        return;
      }
      Event.showSuccess("Update Template.");
    }).catch((err) => {
      Event.showErrorMessage(err);
    });
  }

  const handleDelete = () => {
    RemoveTemplate(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Event.showSuccess("Remove Template.")
      nav("/note/edit/" + parentId);
    }).catch( (err) => {
      Event.showErrorMessage(err);
    });
  }

  const handleCopyId = (e) => {
    copyClipboard(props.id);
    Event.showSuccess("Copied.");
  }

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>ID</FormLabel>
            <TextField value={id} className="linkBtn" onClick={handleCopyId}
              InputProps={{
                startAdornment: ( <InputAdornment position="start" className="linkBtn"> <ContentCopy /> </InputAdornment>)
              }}>
            </TextField>
          </FormControl>

          </>
      }

          <FormControl>
            <FormLabel>Name</FormLabel>
            <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
          </FormControl>

      {mode === "edit" &&
        <>
          <FormControl>
            <FormLabel>Detail</FormLabel>
            <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
          </FormControl>
        </>
      }

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {mode === "register" && <> Create </>}
          {mode === "edit" && <> Save </>}
        </Button>

        {mode === "edit" && 
          <Button style={{marginLeft:"auto"}}
                  variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        }
      </FormControl>
    </Grid>
  </>);
}
export default Template;