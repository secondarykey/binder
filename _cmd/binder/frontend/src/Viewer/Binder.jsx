import { useEffect, useState } from "react";

import { Button, FormControl, FormLabel, Grid, TextField } from "@mui/material";
import { GetConfig,EditConfig } from "../../wailsjs/go/api/App";
/**
 * バインダーのメタデータを表示,編集
 * @param {*} props 
 * @returns 
 */
function Binder(props) {

  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [listNum, setListNum] = useState(0);
  const [branch, setBranch] = useState("main");
  const [auto, setAuto] = useState(0);

  useEffect( () => {
    props.onChangeTitle("Edit Binder");
    GetConfig().then( (conf) => {
      setName(conf.name);
      setDetail(conf.detail);
      setListNum(conf.listNum);
      setBranch(conf.branch);
      setAuto(conf.autoCommit);
    }).catch( (err) => {
      props.onMessage("error",err);
    });
  },[]);

  const handleSave = () => {
    var config = {};
    config.name = name;
    config.detail = detail;
    config.listNum = Number(listNum);
    config.branch = branch;
    config.autoCommit = Number(auto);
    EditConfig(config).then((resp) => {
      props.onMessage("success","update binder.");
    }).catch( (err) => {
      console.warn(err);
      props.onMessage("error",err);
    });
  }

  const setNumeric = (oldV,newV,caller) => {
    var res = Number(newV)
   
    console.log(res)
    if ( isNaN(res) ) {
      res = Number(oldV)
    }
    caller(res);
  }

  return (<>
<Grid className="formGrid">

  <FormControl>
    <FormLabel>Name</FormLabel>
    <TextField value={name} onChange={(e) => setName(e.target.value)}></TextField>
  </FormControl>

  <FormControl>
    <FormLabel>Detail</FormLabel>
    <TextField value={detail} onChange={(e) => setDetail(e.target.value)} multiline="true"></TextField>
  </FormControl>

  <FormControl>
    <FormLabel>{ "List Num(= 0 is no limit)" }</FormLabel>
    <TextField value={listNum} onChange={(e) => setNumeric(listNum,e.target.value,setListNum)}>
    </TextField>
  </FormControl>

  <FormControl>
    <FormLabel>Branch Name(It is only used for PR Links will not be updated.)</FormLabel>
    <TextField value={branch} onChange={(e) => setBranch(e.target.value)}></TextField>
  </FormControl>

  <FormControl>
    <FormLabel>{ "Auto Commit(= 0 is manual)" }</FormLabel>
    <TextField value={auto} onChange={(e) => setNumeric(auto,e.target.value,setAuto)}>
    </TextField>
  </FormControl>

  <FormControl style={{display:"flex",flexFlow:"row",margin:"10px"}}>
    <Button variant="contained" onClick={handleSave}>Save</Button>
  </FormControl>

</Grid>
    </>);
}
export default Binder;