import { useEffect, useState, useRef, useContext, Fragment } from "react";

import { GetFontNames } from "../../wailsjs/go/api/App.js";

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import { Button, FormControl, InputLabel } from "@mui/material";
import { EventContext } from "../Event";
import { MenuItem, Select } from "@mui/material";

import { MuiColorInput } from 'mui-color-input'

/**
 * フォント設定のダイアログ
 * @returns 
 */
export default function FontDialog({ show, onClose }) {

    const evt = useContext(EventContext)
    const [name, setName] = useState("");
    const [fonts, setFonts] = useState([]);
    const [size, setSize] = useState(12);
    const [color, setColor] = useState("#fafafa");
    const [bgcolor, setBGColor] = useState("#111111");

    const handleClose = (e,reason) => {
        console.log(reason)
        if ( reason === 'backdropClick') {
            return;
        }
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

    const handleChangeName = (e) => {
        setName(e.target.value);
    };

    const handleSubmit = (e) => {
        var rtn = {};
        rtn.name = name;
        rtn.size = size;
        rtn.color = color;
        rtn.backgroundColor = bgcolor;
        onClose(rtn)
    };

    const handleChangeColor = (e) => {
        setColor(e)
    }
    const handleChangeBGColor = (e) => {
        setBGColor(e)
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
                <FormControl>
                    <Select value={name} onChange={handleChangeName}>
                        {fonts.map((v) => {
                            return <MenuItem key={v} value={v}>{v}</MenuItem>;
                        })}
                    </Select>
                </FormControl>
                <FormControl>
                    <MuiColorInput format="hex" value={color} onChange={handleChangeColor} />
                    <MuiColorInput format="hex" value={bgcolor} onChange={handleChangeBGColor} />
                </FormControl>

                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit}>OK</Button>
                </DialogActions>
            </Dialog>
    );
}