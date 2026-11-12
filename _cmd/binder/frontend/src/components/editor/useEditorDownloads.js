import { ParseNote, ParseDiagram, OpenDiagram, GetDiagram, CollectExportDeps } from "../../../bindings/binder/api/app";
import { DownloadNote } from "../../../bindings/main/window";

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";
import { downloadBlob, triggerTextDownload } from "./download";
import { Mode } from "../../mode";

/**
 * エディタで開いているもののダウンロード。
 *
 * 読むのは渡された値だけで、エディタの状態は書き換えない。
 * 返す関数は描画のたびに作り直される（memo にした部品へは useStableHandlers を通して渡す）。
 *
 * @param {{
 *   mode: string, id: string, name: string,
 *   text: string,   // 編集中の本文
 *   html: string,   // プレビューに出している HTML（ノート）
 *   onError: (err: any) => void,
 * }} p
 */
export function useEditorDownloads({ mode, id, name, text, html, onError }) {

  /** プレビューをそのままダウンロード（図は SVG、ノートは HTML） */
  const download = async () => {
    if (mode === Mode.diagram) {
      var elm = document.querySelector('#mermaidViewer');
      downloadBlob(elm.innerHTML, 'image/svg+xml', name + '.svg');
    } else if (mode === Mode.note) {
      downloadBlob(html, 'text/html', name + '.html');
    }
  };

  /** テキストをそのままダウンロード（テキストステートから直接） */
  const downloadRaw = () => {
    if (mode === Mode.note) {
      triggerTextDownload(text, name + '.md');
    } else if (mode === Mode.diagram) {
      triggerTextDownload(text, name + '.mmd');
    }
  };

  /** テンプレート関数を展開したテキストをダウンロード（HTML変換前） */
  const downloadExpanded = async () => {
    try {
      if (mode === Mode.note) {
        const result = await ParseNote(id, false, text);
        if (result.error) { onError(result.error); return; }
        triggerTextDownload(result.html, name + '.md');
      } else if (mode === Mode.diagram) {
        const result = await ParseDiagram(id, false, text);
        if (result.error) { onError(result.error); return; }
        triggerTextDownload(result.html, name + '.mmd');
      }
    } catch (err) {
      onError(err);
    }
  };

  /** ノートと、参照している図・アセットを zip にまとめてダウンロード */
  const downloadZip = async () => {
    try {
      // 依存関係を収集（テンプレート関数展開のためMarkdownを渡す）
      const deps = await CollectExportDeps(id, text);
      const diagramSVGs = {};

      if (deps && deps.missingDiagrams && deps.missingDiagrams.length > 0) {
        for (const diag of deps.missingDiagrams) {
          try {
            const source = await OpenDiagram(diag.id);
            const expandResult = await ParseDiagram(diag.id, false, source);
            if (expandResult.error) throw new Error(expandResult.error);
            const diagMeta = await GetDiagram(diag.id);
            const result = await Mermaid.parse(expandResult.html, diagMeta.styleTemplate);
            if (result && result.svg) {
              diagramSVGs[diag.id] = result.svg;
            }
          } catch (diagErr) {
            console.warn("diagram SVG generation failed:", diag.id, diagErr);
          }
        }
      }

      const expanded = await Marked.parse(deps.expandedMarkdown);
      await DownloadNote(id, text, expanded, diagramSVGs);
    } catch (err) {
      onError(err);
    }
  };

  return { download, downloadRaw, downloadExpanded, downloadZip };
}
