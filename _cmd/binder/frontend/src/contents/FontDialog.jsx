import { useEffect, useState, useRef, useContext, Fragment, isValidElement } from "react";

import { GetFontNames } from "../../wailsjs/go/api/App.js";

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import { Button, DialogContent, FormControl, InputLabel, TextField } from "@mui/material";
import { EventContext } from "../Event";
import { MenuItem, Select } from "@mui/material";

import { MuiColorInput } from 'mui-color-input'

/**
 * フォント設定のダイアログ
 * @returns 
 */
export default function FontDialog({ show, font, onClose }) {

  const evt = useContext(EventContext)
  const [name, setName] = useState(font === undefined ? "Araial" : font.name);
  const [size, setSize] = useState(font === undefined ? 16:font.size);
  const [color, setColor] = useState(font === undefined ? "#fafafa": font.color);
  const [bgcolor, setBGColor] = useState(font === undefined ? "#111111" : font.backgroundColor);

  const [fonts, setFonts] = useState([]);
  const [text, setText] = useState(`package main
import "fmt"

func main() {
  fmt.Println("Hello, Binder!")
}`);

  const [style, setStyle] = useState({});

  const handleClose = (e, reason) => {
    //if ( reason === 'backdropClick') {
    //   return;
    //}
    onClose();
  };

  useEffect(() => {
    GetFontNames().then((names) => {
      setFonts(names);
    }).catch((err) => {
      console.log(err)
      evt.showErrorMessage(err);
    })
  }, []);

  //フォント設定があった場合
  useEffect(() => {
    if ( font === undefined ) {
      return;
    }
    setName(font.name)
    setSize(font.size)
    setColor(font.color)
    setBGColor(font.backgroundColor)
    changeStyle(font.name,font.size,font.color,font.backgroundColor);
  }, [font]);

  const handleSubmit = (e) => {
    var rtn = {};
    rtn.name = name;
    rtn.size = Number(size);
    rtn.color = color;
    rtn.backgroundColor = bgcolor;
    onClose(rtn)
  };

  const changeStyle = (name, size, color, bgcolor) => {
    var obj = {
      "fontFamily": name,
      "fontSize": size + "px",
      "color": color,
      "backgroundColor": bgcolor
    }
    setStyle(obj);
  }

  const handleChangeName = (e) => {
    var val = e.target.value;
    setName(val);
    changeStyle(name,size,color,bgcolor);
  };

  const handleChangeSize = (e) => {
    var val = e.target.value;
    setSize(val);
    changeStyle(name,val,color,bgcolor);
  }

  const handleChangeColor = (e) => {
    setColor(e)
    changeStyle(name,size,e,bgcolor);
  }

  const handleChangeBGColor = (e) => {
    setBGColor(e)
    changeStyle(name,size,color,e);
  } 

  const handleChangeText = (e) => {
    setText(e.target.value)
  } 

  return (

    <Dialog open={show} onClose={handleClose}
      sx={{
        "& .MuiDialog-container": {
          "& .MuiPaper-root": {
            width: "100%",
            maxWidth: "500px",
          },
        },
      }}
    >
      <DialogTitle>Font Setting</DialogTitle>
      <DialogContent>

        {/** フォント一覧 */}
        <FormControl style={{"width":"100%"}}>
          <Select value={name} onChange={handleChangeName} style={{ "minWidth": "100%" }}>
            {fonts.map((v) => {
              return <MenuItem key={v} value={v}>{v}</MenuItem>;
            })}
          </Select>
        </FormControl>

        {/** サイズ、色、背景色の指定 */}
        <FormControl style={{"display":"flex","flexDirection":"row"}}>
          <TextField value={size} onChange={handleChangeSize} type="number" />
          <MuiColorInput format="hex" value={color} onChange={handleChangeColor} />
          <MuiColorInput format="hex" value={bgcolor} onChange={handleChangeBGColor} />
        </FormControl>

        {/** サンプルコード */}
        <FormControl style={{"width":"100%","height":"100px"}}>
          <TextField className="codeSample" multiline fullWidth 
                     value={text} onChange={handleChangeText}
                     slotProps={{
                        input: {
                          style: style
                        }
                     }}
          />
        </FormControl>

      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit}>OK</Button>
      </DialogActions>
    </Dialog>
  );
}