import { useEffect, useState, useRef ,useContext} from "react";
import { useParams } from "react-router";

import { GetNowPatch, GetSetting } from "../../bindings/binder/api/app";

import {EventContext} from "../Event";

/**
 * パッチの行数を解析
 * @param {*} line 
 * @returns 
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
 * パッチの行数取得
 * @param {*} line 
 * @returns 
 */
function isDiffLine(line) {

    var idx = line.indexOf("@@");
    //@@が2つ存在
    if (idx !== -1) {
        var startIdx = idx + 2
        idx = line.substring(startIdx).indexOf("@@");
        if (idx !== -1) {
            var lastIdx = idx + startIdx;
            var diff = line.substring(startIdx, lastIdx);
            var remain = line.substring(lastIdx + 2);
            var obj = {};
            obj.remain = remain;
            var sd = diff.split(" ");

            sd.forEach((line) => {
                if (line === "") {
                    return;
                }
                idx = line.indexOf("-");
                if (idx !== -1) {
                    obj.minus = createPosition(line.substring(idx + 1));
                }
                idx = line.indexOf("+");
                if (idx !== -1) {
                    obj.plus = createPosition(line.substring(idx + 1));
                }
            });

            if ((obj.minus === undefined) || (obj.plus === undefined)) {
                return undefined;
            }
            return obj;
        }
    }
    //@@ 内に-,+が存在
    return undefined;
}

/**
 * パッチコンポーネント
 * @param {*} props 
 * @returns 
 */
function Patch(props) {

    const evt = useContext(EventContext)
    const { type, currentId } = useParams();

    const [patch, setPatch] = useState("");
    const [source, setSource] = useState("");
    const [html, setHtml] = useState("");
    const [rows, setRows] = useState("");
    const [fontName, setFontName] = useState("monospace");
    const [fontSize, setFontSize] = useState(14);
    const viewer = useRef();
    const lineViewer = useRef();
    useEffect(() => {
        //同時スクロール
        viewer.current.addEventListener("scroll", function () {
            lineViewer.current.scrollTop = viewer.current.scrollTop;
        })
        //エディタのフォント設定を取得
        GetSetting().then((s) => {
            const f = s?.lookAndFeel?.editor?.text;
            if (f) {
                if (f.name) setFontName(f.name);
                if (f.size) setFontSize(f.size);
            }
        }).catch(() => {});
    }, [])

    useEffect(() => {
        //現在のファイルシステムとのパッチを取得
        GetNowPatch(type, currentId).then((resp) => {
            setPatch(resp.patch);
            setSource(resp.source);
        }).catch((err) => {
            evt.showErrorMessage(err);
        })
    }, [type,currentId])

    var parentStyle = {
        position: "relative",
        width: "calc(100% - 46px)",
        height: "100%",
    }

    var digit = 3;
    var pos = (fontSize *  digit) + "px";

    var lineStyle = {
        backgroundColor: "#222222",
        border: "0",
        borderRight: "1px double #cccccc",
        position: "absolute",
        width: "calc(" + pos + ")",
        zIndex: 10,
        color: "#eeeeee",
        paddingRight: "5px",
        fontSize: fontSize + "px",
        fontFamily: fontName,
        height: "100%",
        textAlign: "right",
        overflow: "hidden",
        whiteSpace: "pre-line",
    }

    var textStyle = {
        backgroundColor: "#222222",
        color: "#eeeeee",
        whiteSpace: "pre",
        fontSize: fontSize + "px",
        fontFamily: fontName,
        width: "100%",
        height: "100%",
        overflow: "auto",
        paddingLeft: pos,
    }

    useEffect(() => {

        var vals = source.split("\n");
        var diff = undefined;

        var plus = {};
        var minus = {};

        var lines = []
        //ソースを行で展開
        vals.forEach((line) => {
            lines.push(line);
        })

        vals = patch.split("\n");

        var now = 1;
        //パッチによる、色付け、
        vals.forEach((line) => {

            var wk = isDiffLine(line);
            if (wk !== undefined) {
                diff = wk;
                //line = diff.remain;
                num = diff.plus.start;
                //後続の処理を設定
                now = num;
                //変更箇所に一旦色をつけておく
                for (var idx = 1; idx <= diff.plus.end; ++idx) {
                    plus[num] = "green";
                    num++;
                }
                //飛ばす
                return;
            }

            //ヘッダ部分を飛ばす
            if (diff === undefined) return;
            //意味のない行は飛ばす
            if (line.length < 1) {
                return;
            }

            var flag = line.substring(0, 1);
            if (flag === "+") {
                now++
            } else if (flag === "-") {
                var wk = minus[now];
                if (wk === undefined) {
                    wk = [];
                }
                wk.push(line.substring(1));
                minus[now] = wk;
            } else if (flag === "\\") {

            } else if (flag === " ") {
                //消し込む
                plus[now] = undefined;
                now++;
            }

            //console.log(diff);
            //Plus ,Minus で装飾を決定
        })

        var num = 1;
        var html = [];
        var nums = [];

        var write = function (key, color, line, num) {
            html.push(<div key={"line_" + key} style={{ color: color }}> {line} </div>);
            nums.push(<div key={"num_" + key} style={{ color: color }}> {num} </div>);
        }

        //実際に表示する処理
        lines.forEach((line) => {

            var c = "";
            if (plus[num]) {
                c = plus[num];
            }

            write("g_" + num, c, line, num);

            if (minus[num]) {
                var m = minus[num];
                m.forEach((del, idx) => {
                    write("m_" + idx + "_" + num, "red", del, "\u00A0-");
                })
            }

            num++;
            return;
        });

        setRows(nums);
        setHtml(html);

    }, [source,patch]);

    return (<>
        <div style={parentStyle} id="lines">
            <div style={lineStyle} ref={lineViewer}>{rows}</div>
            <div style={textStyle} ref={viewer}>{html}</div>
        </div>
    </>)
}

export default Patch;