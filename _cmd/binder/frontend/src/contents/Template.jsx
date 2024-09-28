import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { EditTemplate, GetTemplate } from "../../wailsjs/go/api/App";
import { copyClipboard } from "../App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";
import ContentCopy from '@mui/icons-material/ContentCopy';

import Event from "../Event";
import Message from '../Message';

/**
 * テンプレートの作成、編集を行う
 * @param {*} props 
 * @returns 
 */
function Template(props) {

  const nav = useNavigate();
  const { mode, currentId } = useParams();

  const [id, setId] = useState("");

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
  }, []);

  useEffect(() => {

    if (!currentId) {
      return;
    }

    setName("");
    setDetail("")

    if (mode === "register") {
      setId("");

      var t = "";
      switch (currentId) {
        case "DIR_HTML_Layout":
          t = "html_layout"
          break;
        case "DIR_HTML_Content":
          t = "html_content"
          break;
        case "DIR_Note":
          t = "note"
          break;
        case "DIR_Diagram":
          t = "diagram"
          break;
        case "DIR_Template":
          t = "template"
          break;
        default:
          console.error(currentId);
          break;
      }

      console.log(t)

      setType(t);
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
      Message.showError(err);
    })
  }, [currentId]);

  //保存
  const handleSave = () => {

    var data = {};
    data.id = id
    data.name = name
    data.detail = detail
    data.type = type

    if ( name === "" ) {
      Message.showWarning("name is required");
      return;
    }

    EditTemplate(data).then((resp) => {
      Event.refreshTree();
      if (mode === "register") {
        nav("/template/edit/" + resp.id);
        return;
      }
      Message.showSuccess("Update Template.");
    }).catch((err) => {
      Message.showError(err);
    });
  }

  const handleDelete = () => {
    RemoveTemplate(id).then((resp) => {
      Event.refreshTree();
      // 遷移する
      Message.showSuccess("Remove Template.")

      //TODO 選択できるかな？

    }).catch((err) => {
      Message.showError(err);
    });
  }

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <FormControl>
          <FormLabel>ID</FormLabel>
          <TextField value={id} />
        </FormControl>
      }

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true}></TextField>
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {mode === "register" && <> Create </>}
          {mode === "edit" && <> Save </>}
        </Button>

        {mode === "edit" &&
          <Button style={{ marginLeft: "auto" }}
            variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        }
      </FormControl>
    </Grid>
  </>);
}
export default Template;