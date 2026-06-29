import { useState } from "react";

import { Alert, Box, Collapse, Dialog, DialogContent, DialogContentText, DialogTitle, IconButton, Link, Slide, Snackbar } from '@mui/material';

import CloseIcon from "@mui/icons-material/Close";
import Event, { useEventListener } from "./Event";
import { parseError } from "./error";
import "./language";
import { useTranslation } from 'react-i18next';

class Message {

    /**
     * 表示用メッセージオブジェクトを生成する。
     * 成功/情報メッセージは文字列、エラーは Error/構造化エラーを受け取り、
     * parseError で { body, detail, debug, kind } に正規化する。
     * Go 側が kind を指定している場合はそちらを優先する（info / warning）。
     */
    static createMessage(type, msg) {
        if (type === "clear") {
            return { type, body: "", detail: "", debug: "" };
        }
        const parsed = parseError(msg);
        const resolvedType = parsed.kind || type;
        return { type: resolvedType, body: parsed.body, detail: parsed.detail, debug: parsed.debug };
    }
}

export function SystemMessage(props) {

    const {t} = useTranslation();

    //メッセージ状態
    const [msgObj, setMessage] = useState({ type: "success", body: "", detail: "", debug: "", show: false });
    const [msgDlg, setMessageDialog] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    //イベント登録
    useEventListener(Event.ShowMessage, (obj) => {
        showSlideMessage(obj);
    });

    //ポップアップ処理
    function SlideTransition(props) {
        return <Slide {...props} direction="up" />;
    }

    /**
     * メッセージを消去する
     */
    function hideSlideMessage() {
        if (!msgDlg) {
            setMessage((m) => ({ ...m, show: false }));
        }
    }

    function showSlideMessage(obj) {

        if (obj.type === "clear") {
            hideSlideMessage();
            return;
        }
        setMessage({ ...obj, show: true, key: Date.now() });
    }

    function closeDialog(e, reason) {
        if (reason !== 'backdropClick') {
            setMessageDialog(false);
            setShowDebug(false);
            hideSlideMessage();
        }
    }

    function showMessageDialog() {
        // 詳細またはデバッグ情報があるときのみダイアログを開く
        if (msgObj.detail || msgObj.debug) {
            setMessageDialog(true);
        }
    }

    return (
        <>
            {/** ポップアップ表示（body のみ） */}
            <Snackbar key={msgObj.key}
                open={msgObj.show && !msgDlg}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                TransitionComponent={SlideTransition}
                onDoubleClick={showMessageDialog}
                onClose={hideSlideMessage}
                autoHideDuration={msgObj.type === "success" ? 2000 : null}>
                <Alert severity={msgObj.type}
                    variant="filled"
                    sx={{ width: '100%' }}>
                    {msgObj.body}
                </Alert>
            </Snackbar>

            {/*  詳細ダイアログ（ダブルクリックで表示） */}
            <Dialog open={msgDlg}
                keepMounted
                onClose={closeDialog}
                aria-describedby="alert-dialog-slide-description" >
                <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', pr: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{msgObj.body}</Box>
                    <IconButton size="small" aria-label="close" onClick={closeDialog} sx={{ ml: 1, color: 'var(--text-muted)' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {msgObj.detail && (
                        <DialogContentText id="alert-dialog-slide-description" className="messageTxt" sx={{ whiteSpace: 'pre-wrap' }}>
                            {msgObj.detail}
                        </DialogContentText>
                    )}
                    {msgObj.debug && (
                        <Box sx={{ mt: msgObj.detail ? 2 : 0 }}>
                            <Link component="button" type="button" underline="hover"
                                onClick={() => setShowDebug((v) => !v)}
                                sx={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {t("common.debugInfo")}
                            </Link>
                            <Collapse in={showDebug}>
                                <Box component="pre" sx={{
                                    mt: 0.5, p: 1, m: 0,
                                    fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                    backgroundColor: 'var(--bg-overlay)', borderRadius: '4px',
                                    maxHeight: 240, overflow: 'auto',
                                }}>
                                    {msgObj.debug}
                                </Box>
                            </Collapse>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

export default Message;
