import { useEffect, useState, useContext } from "react";

import { GetFontNames } from "../../bindings/binder/api/app";

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import { Box, DialogContent, FormControl, FormLabel, IconButton, TextField, Tooltip } from "@mui/material";
import { EventContext } from "../Event";
import CheckIcon from "@mui/icons-material/Check";
import { useDialogMessage } from './components/DialogError';
import { ActionButton } from './components/ActionButton';
import { MenuItem, Select } from "@mui/material";
import { Close } from "@mui/icons-material";

import { MuiColorInput } from 'mui-color-input'
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * フォント設定のダイアログ
 * @returns 
 */
export default function FontDialog({ show, font, onClose }) {

  const evt = useContext(EventContext)
  const { showError } = useDialogMessage();
  const {t} = useTranslation();
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
      showError(err);
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
    changeStyle(val,size,color,bgcolor);
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
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", width: "100%", maxWidth: "600px" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1 }}>{t("font.title")}</span>
        <IconButton size="small" onClick={handleClose} aria-label="close">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>

        {/** フォント名・サイズ */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, mt: 1 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>{t("font.name")}</FormLabel>
            <Select value={name} onChange={handleChangeName} size="small"
                    MenuProps={{ PaperProps: { style: { maxHeight: 10 * 36 } } }}>
              {fonts.map((v) => {
                return <MenuItem key={v} value={v}>{v}</MenuItem>;
              })}
            </Select>
          </FormControl>
          <FormControl sx={{ width: "80px" }}>
            <FormLabel>{t("font.size")}</FormLabel>
            <TextField value={size} onChange={handleChangeSize} type="number" size="small"
                       slotProps={{ input: { style: { textAlign: "right" } } }} />
          </FormControl>
        </Box>

        {/** 文字色・背景色 */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>{t("font.color")}</FormLabel>
            <MuiColorInput format="hex" value={color} onChange={handleChangeColor} size="small" />
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>{t("font.backgroundColor")}</FormLabel>
            <MuiColorInput format="hex" value={bgcolor} onChange={handleChangeBGColor} size="small" />
          </FormControl>
        </Box>

        {/** サンプル */}
        <FormControl sx={{ width: "100%" }}>
          <FormLabel>{t("font.sample")}</FormLabel>
          <TextField className="codeSample" multiline fullWidth
                     value={text} onChange={handleChangeText}
                     sx={{
                       '& .MuiOutlinedInput-root': {
                         backgroundColor: bgcolor + ' !important',
                         height: '200px',
                         alignItems: 'flex-start',
                         overflow: 'auto',
                       }
                     }}
                     slotProps={{
                        input: {
                          style: style
                        }
                     }}
          />
        </FormControl>

      </DialogContent>

      <DialogActions>
        <ActionButton variant="confirm" label={t("common.ok")} icon={<CheckIcon />} onClick={handleSubmit} />
      </DialogActions>
    </Dialog>
  );
}