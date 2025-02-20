import { useEffect, useState,useContext } from "react";
import { useNavigate, useParams } from "react-router";

import { EditTemplate, GetTemplate } from "../../wailsjs/go/api/App";

import { Button, FormControl, FormLabel, Grid, InputAdornment, TextField } from "@mui/material";

import {EventContext} from "../Event";

/**
 * テンプレートの作成、編集を行う
 * @param {*} props 
 * @returns 
 */
function Template(props) {

  const evt = useContext(EventContext)
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
      evt.changeTitle("Register Template");
      return;
    } else {
      setId(currentId)
    }

    GetTemplate(currentId).then((data) => {
      setName(data.name);
      setDetail(data.detail)
      setType(data.type)
      evt.changeTitle("Edit Template:" + data.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
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
      evt.showWarningMessage("name is required");
      return;
    }

    EditTemplate(data).then((resp) => {
      evt.refreshTree();
      if (mode === "register") {
        nav("/template/edit/" + resp.id);
        return;
      }
      evt.showSuccessMessage("Update Template.");
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }

  const handleDelete = () => {
    RemoveTemplate(id).then((resp) => {
      evt.refreshTree();
      // 遷移する
      evt.showSuccessMessage("Remove Template.")

      //TODO 選択できるかな？

    }).catch((err) => {
      evt.showErrorMessage(err);
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