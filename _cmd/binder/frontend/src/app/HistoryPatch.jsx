import { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router";

import { Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import DiffIcon from "@mui/icons-material/Difference";

import { Events, Window } from "@wailsio/runtime";

import { GetFont,GetHistoryPatch, GetModifiedIds, RestoreHistory } from "../../bindings/binder/api/app";

import { EventContext } from "../Event";
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * パッチの行数を解析
 */
function createPosition(line) {
    var s = line.split(",");
    var pos = {};
    pos.start = s[0];
    if (s.length > 1) {
        pos.end = s[1];
    } else {
        pos.end = s[0];
    }
    return pos;
}

/**
 * パッチの @@...@@ ヘッダ行を解析
 */
function isDiffLine(line) {
    var idx = line.indexOf("@@");
    if (idx !== -1) {
        var startIdx = idx + 2;
        idx = line.substring(startIdx).indexOf("@@");
        if (idx !== -1) {
            var lastIdx = idx + startIdx;
            var diff = line.substring(startIdx, lastIdx);
            var obj = {};
            obj.remain = line.substring(lastIdx + 2);
            var sd = diff.split(" ");
            sd.forEach((l) => {
                if (l === "") return;
                var i = l.indexOf("-");
                if (i !== -1) obj.minus = createPosition(l.substring(i + 1));
                i = l.indexOf("+");
                if (i !== -1) obj.plus  = createPosition(l.substring(i + 1));
            });
            if (!obj.minus || !obj.plus) return undefined;
            return obj;
        }
    }
    return undefined;
}

/**
 * テキストを行番号付き要素配列に変換
 */
function buildPlainView(text) {
    const lines = text.split("\n");
    const html = [];
    const nums = [];
    lines.forEach((line, i) => {
        const n = i + 1;
        html.push(<div key={"p_" + n}> {line} </div>);
        nums.push(<div key={"n_" + n}> {n} </div>);
    });
    return { html, nums };
}

/**
 * source + patch から差分着色済み要素配列を生成
 */
function buildDiffView(source, patch) {
    const lines = source.split("\n");
    const vals  = patch.split("\n");

    var diff = undefined;
    var plus = {};
    var minus = {};
    var now = 1;
    var num;

    vals.forEach((line) => {
        var wk = isDiffLine(line);
        if (wk !== undefined) {
            diff = wk;
            num  = diff.plus.start;
            now  = num;
            for (var idx = 1; idx <= diff.plus.end; ++idx) {
                plus[num] = "red";
                num++;
            }
            return;
        }
        if (diff === undefined) return;
        if (line.length < 1) return;

        var flag = line.substring(0, 1);
        if (flag === "+") {
            now++;
        } else if (flag === "-") {
            var wk = minus[now];
            if (wk === undefined) wk = [];
            wk.push(line.substring(1));
            minus[now] = wk;
        } else if (flag === " ") {
            plus[now] = undefined;
            now++;
        }
    });

    var n = 1;
    const html = [];
    const nums = [];

    var write = (key, color, line, num) => {
        html.push(<div key={"line_" + key} style={{ color: color }}> {line} </div>);
        nums.push(<div key={"num_"  + key} style={{ color: color }}> {num}  </div>);
    };

    lines.forEach((line) => {
        var c = plus[n] ?? "";
        write("g_" + n, c, line, n);
        if (minus[n]) {
            minus[n].forEach((del, idx) => {
                write("m_" + idx + "_" + n, "green", del, "\u00A0-");
            });
        }
        n++;
    });

    return { html, nums };
}

/**
 * 行番号付きテキストパネル
 */
function TextPanel({ rows, html, fontName, fontSize, fontColor, fontBgColor, scrollRef, lineRef }) {
    const pos = (fontSize * 3) + "px";

    const lineStyle = {
        backgroundColor: fontBgColor,
        border: "0",
        borderRight: "1px double #cccccc",
        boxSizing: "border-box",
        position: "absolute",
        width: pos,
        zIndex: 10,
        color: fontColor,
        paddingRight: "5px",
        fontSize: fontSize + "px",
        fontFamily: fontName,
        height: "100%",
        textAlign: "right",
        overflow: "hidden",
        whiteSpace: "pre-line",
    };

    const textStyle = {
        backgroundColor: fontBgColor,
        color: fontColor,
        whiteSpace: "pre",
        fontSize: fontSize + "px",
        fontFamily: fontName,
        width: "100%",
        height: "100%",
        overflow: "auto",
        paddingLeft: pos,
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div style={lineStyle} ref={lineRef}>{rows}</div>
            <div style={textStyle} ref={scrollRef}>{html}</div>
        </div>
    );
}

/**
 * 履歴パッチコンポーネント（左右分割）
 * 左: 選択コミット時点のテキスト / 右: 現在ファイルとの差分
 * @param {{ typ: string, id: string }} props
 */
function HistoryPatch({ typ, id }) {

    const evt = useContext(EventContext);
    const { hash } = useParams();
    const {t} = useTranslation();

    const [source,     setSource]     = useState("");
    const [historical, setHistorical] = useState("");
    const [patch,      setPatch]      = useState("");
    const [fontName,   setFontName]   = useState("monospace");
    const [fontSize,   setFontSize]   = useState(14);
    const [fontColor,  setFontColor]  = useState("var(--text-secondary)");
    const [fontBgColor, setFontBgColor] = useState("var(--bg-overlay)");
    const [confirmOpen, setConfirmOpen] = useState(false);
    // デフォルトは履歴ファイルのみ表示。Diff ボタンで差分パネルをトグル
    const [showDiff, setShowDiff] = useState(true);
    const [loading, setLoading] = useState(false);

    const histScrollRef = useRef();
    const histLineRef   = useRef();
    const diffScrollRef = useRef();
    const diffLineRef   = useRef();

    // 差分パネルが表示されているときだけスクロール同期を設定する
    useEffect(() => {
        const histEl = histScrollRef.current;
        if (!histEl) return;
        const syncHist = () => { if (histLineRef.current) histLineRef.current.scrollTop = histEl.scrollTop; };
        histEl.addEventListener("scroll", syncHist);
        return () => { histEl.removeEventListener("scroll", syncHist); };
    }, []);

    useEffect(() => {
        if (!showDiff) return;
        const diffEl = diffScrollRef.current;
        if (!diffEl) return;
        const syncDiff = () => { if (diffLineRef.current) diffLineRef.current.scrollTop = diffEl.scrollTop; };
        diffEl.addEventListener("scroll", syncDiff);
        return () => { diffEl.removeEventListener("scroll", syncDiff); };
    }, [showDiff]);

    useEffect(() => {
        GetFont().then((f) => {
            if (f) {
                if (f.name) setFontName(f.name);
                if (f.size) setFontSize(f.size);
                if (f.color) setFontColor(f.color);
                if (f.backgroundColor) setFontBgColor(f.backgroundColor);
            }
        }).catch(() => {});

        // フォント変更イベントを受信して同期
        const cleanup = Events.On('binder:editor:fontChanged', (event) => {
            const f = event.data?.[0] ?? event.data ?? {};
            if (f.name) setFontName(f.name);
            if (f.size) setFontSize(f.size);
            if (f.color) setFontColor(f.color);
            if (f.backgroundColor) setFontBgColor(f.backgroundColor);
        });
        return () => { cleanup(); };
    }, []);

    useEffect(() => {
        if (!typ || !id || !hash) return;
        setLoading(true);
        GetHistoryPatch(typ, id, hash).then((resp) => {
            setSource(resp.source);
            setHistorical(resp.historical);
            setPatch(resp.patch);
        }).catch((err) => {
            evt.showErrorMessage(err);
        }).finally(() => {
            setLoading(false);
        });
    }, [typ, id, hash]);

    // Restore ボタン押下: 未コミット変更があれば確認ダイアログ、なければ即時実行
    const handleRestoreClick = () => {
        if (!typ || !id || !hash) return;
        GetModifiedIds().then((ids) => {
            const modified = (ids ?? []).includes(id);
            if (modified) {
                setConfirmOpen(true);
            } else {
                doRestore();
            }
        }).catch(() => {
            doRestore();
        });
    };

    const doRestore = () => {
        RestoreHistory(typ, id, hash).then(() => {
            // メインウィンドウにファイルを再オープンするよう通知してから閉じる
            Events.Emit("binder:restored", { typ, id });
            Window.Close();
        }).catch((err) => {
            evt.showErrorMessage(err);
        });
    };

    const { html: histHtml, nums: histNums } = buildPlainView(historical);
    const { html: diffHtml, nums: diffNums } = showDiff ? buildDiffView(source, patch) : { html: [], nums: [] };

    const panelLabelStyle = {
        fontSize: "0.7rem",
        color: "var(--text-disabled)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderBottom: "1px solid var(--border-primary)",
        backgroundColor: "var(--bg-titlebar)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    };

    const panelStyle = {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
    };

    const btnSx = {
        fontSize: "0.65rem", py: 0, px: 1,
        color: "var(--text-muted)", borderColor: "var(--border-strong)",
        textTransform: "none",
        "&:hover": { borderColor: "var(--text-muted)", color: "var(--text-primary)" },
    };

    return (
        <>
        <div style={{ display: "flex", width: "100%", height: "100%" }}>

            {/* 履歴ファイル表示パネル */}
            <div style={{ ...panelStyle, borderRight: showDiff ? "1px solid var(--border-primary)" : "none" }}>
                <div style={panelLabelStyle}>
                    {/* 左: Historical ラベル + Restore ボタン */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>Historical</span>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RestoreIcon fontSize="small" />}
                            onClick={handleRestoreClick}
                            disabled={!hash}
                            sx={btnSx}
                        >
                            Restore
                        </Button>
                    </div>
                    {/* 右: Diff トグルボタン */}
                    <Tooltip title="Diff">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => setShowDiff(v => !v)}
                                disabled={!hash || !patch}
                                sx={{
                                    borderRadius: "4px",
                                    border: "1px solid",
                                    borderColor: showDiff ? "var(--selected-bg)" : "var(--border-strong)",
                                    color: showDiff ? "var(--text-primary)" : "var(--text-muted)",
                                    backgroundColor: showDiff ? "var(--selected-bg)" : "transparent",
                                    padding: "1px 4px",
                                    "&:hover": {
                                        borderColor: showDiff ? "var(--selected-bg)" : "var(--text-muted)",
                                        color: "var(--text-primary)",
                                        backgroundColor: showDiff ? "var(--selected-hover)" : "transparent",
                                    },
                                    "&.Mui-disabled": { opacity: 0.3 },
                                }}
                            >
                                <DiffIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                    {loading && (
                        <div style={{
                            position: "absolute", inset: 0, zIndex: 20,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: "var(--bg-overlay)",
                        }}>
                            <CircularProgress size={24} thickness={4} sx={{ color: "var(--text-disabled)" }} />
                        </div>
                    )}
                    <TextPanel
                        rows={histNums}
                        html={histHtml}
                        fontName={fontName}
                        fontSize={fontSize}
                        fontColor={fontColor}
                        fontBgColor={fontBgColor}
                        scrollRef={histScrollRef}
                        lineRef={histLineRef}
                    />
                </div>
            </div>

            {/* 右: 現在ファイルとの差分（Diff ボタンで表示） */}
            {showDiff && (
                <div style={panelStyle}>
                    <div style={panelLabelStyle}>
                        <span>Current (diff)</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                        <TextPanel
                            rows={diffNums}
                            html={diffHtml}
                            fontName={fontName}
                            fontSize={fontSize}
                            fontColor={fontColor}
                            fontBgColor={fontBgColor}
                            scrollRef={diffScrollRef}
                            lineRef={diffLineRef}
                        />
                    </div>
                </div>
            )}

        </div>

        {/* 未コミット変更がある場合の確認ダイアログ */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
            <DialogTitle>{t("history.restoreTitle")}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t("history.restoreWarning")}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
                <Button color="warning" onClick={() => { setConfirmOpen(false); doRestore(); }}>
                    {t("history.restore")}
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

export default HistoryPatch;
