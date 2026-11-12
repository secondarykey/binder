import { useState, useEffect, useRef } from "react";

import { ParseNote, CreateNoteHTML, ParseDiagram, OpenDiagram, SaveTemplate } from "../../../bindings/binder/api/app";
import { Events } from '@wailsio/runtime';

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";
import { hasAlertsPlugin } from "@shared/editor/alerts";
import { hasConflictMarkers, buildConflictHTML } from "./conflict-view";
import { extractMermaidErrorLine, runTemplatePreview } from "./preview-run";
import { attachDiagramPanZoom } from "./diagram-pan-zoom";
import { Mode } from "../../mode";

/**
 * 本文からプレビューを作る（ノートの HTML・図の SVG・テンプレートのプレビュー）。
 *
 * 持っている状態は、プレビューに出す HTML（html）と変換の結果（parseStatus）だけ。
 * **いつ作るか**（開いた直後は即時・入力中はデバウンス・読み込み中は作らない）は本体が決める。
 * ここは呼ばれたときに、渡された本文で 1 回作るだけにしている。
 *
 * 図は React の状態を通さず、`#mermaidViewer` の中身を直接書き換える。
 * 返す関数は描画のたびに作り直され、その描画の mode / id / text を見る。
 *
 * @param {{
 *   mode: string, id: string, name: string, text: string,
 *   idRef: { current: string },          // いま開いている ID（変換している間に別のものを開いたら結果を捨てる）
 *   cursorLineRef: { current: number },  // カーソル行。HTML と同時にプレビューへ渡す
 *   setCursorLine: (line: number) => void,
 *   setAlertsAvailable: (v: boolean) => void,
 *   styleTemplateId: string,             // 図のスタイルテンプレート
 *   templateType: string,                // テンプレートの種類（layout / content / diagram）
 *   previewNoteId: string, previewOtherTemplateId: string, previewDiagramId: string,
 *   evt: object, t: (key: string) => string,
 * }} p
 */
export function useEditorPreview({
  mode, id, name, text, idRef, cursorLineRef, setCursorLine, setAlertsAvailable,
  styleTemplateId, templateType, previewNoteId, previewOtherTemplateId, previewDiagramId,
  evt, t,
}) {

  // パースステータス（プレビュー下部のステータスバー用）
  const [parseStatus, setParseStatus] = useState({ status: "success", err: null, warnings: [] });

  //viewHTMLのprop
  const [html, setHTML] = useState("");
  // useEffect([]) 内など古いクロージャから最新の html を参照するための ref
  const htmlRef = useRef("");
  useEffect(() => { htmlRef.current = html; }, [html]);

  /**
   * いまの本文でプレビューを作り直す
   */
  const parseText = async () => {
    if (text === "") {
      setParseStatus({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });
      setHTML("");
      const mermaidEl = document.querySelector('#mermaidViewer');
      if (mermaidEl) mermaidEl.innerHTML = '';
      return;
    }

    // 変換している間は前の表示を出したままにする（処理中であることはステータスバーに出る）。
    // 「Loading...」を挟むと、開くたび・挿入のたびにプレビューが点滅する
    setParseStatus({ status: "processing", err: null, warnings: [] });

    if (mode === Mode.diagram) {
      viewDiagram(text).catch((err) => {
        setParseStatus({ status: "error", err, warnings: [] });
        evt.showErrorMessage(err);
      });
    } else if (mode === Mode.note) {
      viewHTML(text).catch((err) => {
        setParseStatus({ status: "error", err, warnings: [] });
        evt.showErrorMessage(err);
      });
    } else if (mode === Mode.template) {
      if (templateType === "diagram") {
        // ダイアグラムテンプレート: 選択中のダイアグラムにテンプレートを適用して描画
        if (!previewDiagramId) return;
        viewDiagramTemplatePreview(text, previewDiagramId).catch((err) => {
          setParseStatus({ status: "error", err, warnings: [] });
          evt.showErrorMessage(err);
        });
      } else {
        if (!previewNoteId || !previewOtherTemplateId || !templateType) return;
        // テンプレートをファイルに即時保存してからプレビューを生成
        await SaveTemplate(id, text);
        runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
          .then((result) => {
            const ws = result.warnings || [];
            if (result.error) {
              setParseStatus({ status: "error", err: result.error, warnings: ws });
            } else {
              setHTML(result.html);
              setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
              Events.Emit('binder:preview:update', { typ: 'template', id, name, html: result.html });
            }
          })
          .catch((err) => setParseStatus({ status: "error", err, warnings: [] }));
      }
    }
  };

  //データをマークダウンからHTMLに変換
  // lineNumbers=true のとき parseWithSourceLines を使い data-src-line 属性を付与する（プレビュー用）
  const createMarked = async (id, txt, local, lineNumbers = false) => {
    var p = ""
    var parseError = false;
    var warnings = [];
    const result = await ParseNote(id, local, txt);
    if (result.error) {
      setParseStatus({ status: "error", err: result.error, errorLine: result.errorLine || 0, warnings: result.warnings || [] });
      parseError = true;
      p = txt;
    } else {
      p = result.html;
      warnings = result.warnings || [];
    }

    var val = lineNumbers ? await Marked.parseWithSourceLines(p) : await Marked.parse(p);
    // プラグインは描画の前に読み込まれるため、描画のたびに囲みのメニューを出すかを決め直す
    setAlertsAvailable(hasAlertsPlugin(Marked.getPluginStatus()));

    // エンジンとプラグインの失敗（CDN読込失敗・読込エラー・実行時例外・互換スキップ・
    // 未適用）を警告として拾う。互換層はプレビューを落とさないために失敗を握り潰すため、
    // ここで出さないとユーザは記法が黙って消えたことにしか気付けない。
    // parse 後に取るのは、実行時例外が parse 中に記録されるため。
    warnings = warnings.concat(Marked.getWarnings(t));

    return { html: val || "", parseError, warnings };
  }

  /**
   * ノートの HTML の表示
   */
  const viewHTML = async (txt) => {
    const _start = Date.now();

    // マージコンフリクトマーカーが残っている間は marked を通さず、
    // 色分けしたコンフリクト表示に切り替える（エディタ側は変更しない）。
    if (hasConflictMarkers(txt)) {
      const conflictHtml = buildConflictHTML(txt, t('editor.conflictBanner'));
      setCursorLine(cursorLineRef.current);
      setHTML(conflictHtml);
      setParseStatus({ status: "warning", err: null, warnings: [t('editor.conflictBanner')] });
      Events.Emit('binder:preview:update', { typ: mode, id, name, html: conflictHtml });
      return;
    }

    var result = await createMarked(id, txt, true, true);
    const noteResult = await CreateNoteHTML(id, true, result.html);
    // 変換している間に別のものを開いていたら、前のノートの結果で表示を書き換えない
    if (idRef.current !== id) return;
    const allWarnings = [...(result.warnings || []), ...(noteResult.warnings || [])];
    if (noteResult.error) {
      setParseStatus({ status: "error", err: noteResult.error, warnings: allWarnings });
    } else {
      // カーソル行は HTML と同時に渡す（先に渡すと、差し替える前の表示がその行へ動いてしまう）
      setCursorLine(cursorLineRef.current);
      setHTML(noteResult.html);
      if (!result.parseError) {
        if (allWarnings.length > 0) {
          setParseStatus({ status: "warning", err: null, warnings: allWarnings });
        } else {
          setParseStatus({ status: "success", err: null, warnings: [], ms: Date.now() - _start });
        }
      }
      Events.Emit('binder:preview:update', { typ: mode, id, name, html: noteResult.html });
    }
  }

  /**
   * ダイアグラムの表示
   */
  const viewDiagram = async (txt) => {
    const _start = Date.now();

    const diagramResult = await ParseDiagram(id, true, txt);
    if (diagramResult.error) {
      const elm = document.querySelector('#mermaidViewer');
      if (elm) elm.innerHTML = '';
      setParseStatus({ status: "error", err: diagramResult.error, errorLine: diagramResult.errorLine || 0, warnings: diagramResult.warnings || [] });
      return;
    }
    let parsedTxt = diagramResult.html;
    const diagWarnings = diagramResult.warnings || [];

    Mermaid.parse(parsedTxt, styleTemplateId).then((data) => {

      // 描いている間に別のものを開いていたら、前の図で表示を書き換えない
      if (idRef.current !== id) return;
      var elm = document.querySelector('#mermaidViewer');
      if (!elm) return;
      elm.innerHTML = data.svg;
      if (diagWarnings.length > 0) {
        setParseStatus({ status: "warning", err: null, warnings: diagWarnings });
      } else {
        setParseStatus({ status: "success", err: null, warnings: [], ms: Date.now() - _start });
      }
      Events.Emit('binder:preview:update', { typ: mode, id, name, html: parsedTxt, styleTemplateId });

      // 中ボタンのドラッグで移動、ホイールで拡大
      attachDiagramPanZoom(elm);

    }).catch((err) => {
      const elm = document.querySelector('#mermaidViewer');
      if (elm) elm.innerHTML = '';
      setParseStatus({ status: "error", err, errorLine: extractMermaidErrorLine(err), warnings: diagWarnings });
    });
  }

  /**
   * ダイアグラムテンプレートのプレビュー: 選択ダイアグラムにテンプレートを適用して描画
   */
  const viewDiagramTemplatePreview = async (templateText, diagramId) => {
    if (!diagramId || !templateText) return;
    OpenDiagram(diagramId).then(async (diagramContent) => {
      const parsedResult = await ParseDiagram(diagramId, true, diagramContent);
      const ws = parsedResult.warnings || [];
      if (parsedResult.error) {
        setParseStatus({ status: "error", err: parsedResult.error, warnings: ws });
        return;
      }
      let parsedContent = parsedResult.html;
      const prefix = `%%{init:${templateText}}%%\n`;
      const fullTxt = prefix + parsedContent;
      Mermaid.parse(fullTxt).then((data) => {
        var elm = document.querySelector('#mermaidViewer');
        if (elm) elm.innerHTML = data.svg;
        setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
        Events.Emit('binder:preview:update', { typ: 'diagram', id, name, html: fullTxt });
      }).catch((err) => {
        setParseStatus({ status: "error", err, warnings: ws });
      });
    }).catch((err) => {
      setParseStatus({ status: "error", err, warnings: [] });
    });
  }

  return {
    html, setHTML, htmlRef,
    parseStatus, setParseStatus,
    parseText, createMarked, viewDiagramTemplatePreview,
  };
}
