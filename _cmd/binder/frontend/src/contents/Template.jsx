import { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";

import { EditTemplate, GetTemplate } from "../../bindings/binder/api/app";

import { Button, FormControl, FormLabel, Grid, TextField } from "@mui/material";

import { EventContext } from "../Event";

/**
 * HTMLテンプレートの作成・編集を行う（layout / content のみ）
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
    setDetail("");

    if (mode === "register") {
      setId("");

      var t = "";
      switch (currentId) {
        case "DIR_HTML_Layout":
          t = "layout";
          break;
        case "DIR_HTML_Content":
          t = "content";
          break;
        default:
          console.error("Unknown template directory:", currentId);
          break;
      }

      setType(t);
      evt.changeTitle("Register Template");
      return;
    } else {
      setId(currentId);
    }

    GetTemplate(currentId).then((data) => {
      setName(data.name);
      setDetail(data.detail);
      setType(data.type);
      evt.changeTitle("Edit Template:" + data.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, [currentId]);

  const handleSave = () => {

    var data = {};
    data.id = id;
    data.name = name;
    data.detail = detail;
    data.type = type;

    if (name === "") {
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

  return (<>
    <Grid className="formGrid">

      {mode === "edit" &&
        <FormControl>
          <FormLabel>ID</FormLabel>
          <TextField value={id} slotProps={{ input: { readOnly: true } }} />
        </FormControl>
      }

      <FormControl>
        <FormLabel>Name</FormLabel>
        <TextField value={name} onChange={(e) => setName(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Detail</FormLabel>
        <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline={true} />
      </FormControl>

      <FormControl style={{ display: "flex", flexFlow: "row", margin: "10px" }}>
        <Button variant="contained" onClick={handleSave}>
          {mode === "register" && <>Create</>}
          {mode === "edit" && <>Save</>}
        </Button>
      </FormControl>

    </Grid>
  </>);
}
export default Template;
