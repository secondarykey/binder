import { useEffect, useState,useContext } from "react";

import { Button, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Slide, Snackbar } from '@mui/material';

import Event,{EventContext} from "./Event";
import "./i18n/config";
import { useTranslation } from 'react-i18next';

class Message {

    static createMessage(type, msg) {
        var wk = "";
        if (typeof msg === 'object') {
            if (msg.stack) {
                wk = msg.stack;
            } else {
                wk = "unknown error:" + msg;
            }
        } else {
            wk = msg;
        }
        return {
            type: type,
            message: wk,
        }
    }
}

/**
 * SnackBarに表示するオブジェクトに編集
 * @param {*} obj 
 * @returns 
 */
const createSlideMessage = (obj) => {
    var msg = obj.message;
    var idx = msg.indexOf("\n");

    if (idx === -1) {

        var idx = msg.indexOf(":");
        if (idx === -1) {
            obj.title = msg;
            obj.message = "";
        } else {
            obj.title = msg.substring(0, idx);
            obj.message = msg.substring(idx + 1);
        }
    } else {
        obj.title = msg.substring(0, idx);
        obj.message = msg.substring(idx + 1);
    }
    obj.show = false;
    return obj;
}

export function SystemMessage(props) {

    const evt = useContext(EventContext)
    const {t} = useTranslation();

    //現在の設定を取得(最初に画面表示を選ぶ)
    var initMsg = createSlideMessage({ type: "success", message: "" });
    //メニューの開閉管理
    const [msgObj, setMessage] = useState(initMsg);
    const [msgDlg, setMessageDialog] = useState(false);

    useEffect(() => {
        //イベント登録
        evt.register("SystemMessage",Event.ShowMessage, (obj) => {
            showSlideMessage(obj);
        })
    }, []);

    //ポップアップ処理
    function SlideTransition(props) {
        return <Slide {...props} direction="up" />;
    }

    /**
     * メッセージを消去する
     */
    function hideSlideMessage() {
        if (!msgDlg) {
            setMessage({ show: false });
        }
    }

    function showSlideMessage(obj) {

        if (obj.type === "clear") {
            hideSlideMessage();
            return;
        }
        var obj = createSlideMessage(obj);
        obj.show = true;
        setMessage(obj);
    }

    function closeDialog(e, reason) {
        if (reason !== 'backdropClick') {
            setMessageDialog(false);
            hideSlideMessage();
        }
    }

    function showMessageDialog() {
        if (msgObj.message !== "") {
            setMessageDialog(true);
        }
    }

    return (
        <>
            {/** ポップアップ表示 */}
            <Snackbar open={msgObj.show && !msgDlg}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                TransitionComponent={SlideTransition}
                onDoubleClick={showMessageDialog}
                onClose={hideSlideMessage}
                autoHideDuration={msgObj.type === "success" ? 2000 : null}>
                <Alert severity={msgObj.type}
                    variant="filled"
                    sx={{ width: '100%' }}>
                    {msgObj.title}
                </Alert>
            </Snackbar>

            {/*  全体のダイアログ */}
            <Dialog open={msgDlg}
                keepMounted
                onClose={closeDialog}
                aria-describedby="alert-dialog-slide-description" >
                <DialogTitle>{msgObj.title}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-slide-description" className="messageTxt">
                        {msgObj.message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog}>{t("common.close")}</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default Message;