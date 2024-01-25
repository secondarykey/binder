import { useState,useEffect } from "react";

import {SelectFile,EditNote,Address} from "../../wailsjs/go/api/App";
import { Button, Container, FormControl, FormLabel, Grid, InputAdornment, Paper, TextField } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { GetNote } from "../../wailsjs/go/api/App";

import noImage from '../assets/images/noimage.png'
/**
 * ノートのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Note(props) {

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState("");
  const [viewImage, setViewImage] = useState("");

  useEffect( () => {

    setImageFile("");
    if ( props.id === "" ) {
      setName("");
      props.onChangeTitle("Create Note");
      return;
    }

    GetNote(props.id).then( (note) => {
      setName(note.name);
      props.onChangeTitle("Edit Note:" + note.name);
    }).catch ( (err) => {
      console.warn(err);
      props.onMessage("error",err);
    })

    Address().then( (address) => {
      setViewImage("http://" + address + "/assets/" + props.id + "/index")
    }).catch ((err) => {
      console.warn(err);
      props.onMessage("error",err);
    }) 

  },[props.id]);

  const handleSave = () => {

    var note = {};
    note.id = props.id;
    note.name = name;

    EditNote(note,imageFile).then((resp) => {

      //新規作成時のみ切り替え
      if ( props.id === "" ) {
        props.onChangeMode("editor",resp.id);
      }
      props.onRefreshTree();
      props.onMessage("success","update note.")

    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error",err);
    });
  }

  const selectFile = () => {
    SelectFile("Page Image File","*.png;*.jpg;*.jpeg;*.webp;").then((f) => {
      if ( f != "" ) {
        setImageFile(f);
      }
    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error",err);
    });
  }

  function setNoImage(e) {
    e.target.src = noImage;
  }

    return (<>
<Grid style={{margin:"40px",marginTop:"20px",display:"flex",flexFlow:"column"}}>

{props.id !== "" &&
<>  
  <FormControl>
    <FormLabel>ID : {props.id} </FormLabel> 
  </FormControl>
</>}

  <FormControl>
    <FormLabel>Name</FormLabel>
    <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
  </FormControl>

  <FormControl>
    <FormLabel>Note Image</FormLabel>
    <TextField value={imageFile}
               onClick={selectFile}
               InputProps={{
               startAdornment: (
                 <InputAdornment position="start">
                   <AttachFileIcon />
                 </InputAdornment>
               )}}></TextField>
  </FormControl>

{(props.id !== "" && viewImage !== "") && 
<>
<Container style={{marginTop:"10px",textAlign:"center"}}>
  <img src={viewImage} onError={setNoImage} style={{height:"200px",width:"fit-content"}}></img>
</Container>
</>
}

  <FormControl style={{display:"flex",flexFlow:"row",margin:"10px"}}>
    <Button variant="contained" onClick={handleSave}>
{props.id !== "" && <> Save </> }
{props.id === "" && <> Create </> }
    </Button>
  </FormControl>

</Grid>
    </>);
}
export default Note;