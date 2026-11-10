import {
  OpenNote, OpenDiagram, OpenTemplate, GetDiagram,
  ParseNote, ParseDiagram,
} from '../bindings/binder/api/app';

import Marked from './components/editor/engines/Marked';
import Mermaid from './components/editor/engines/Mermaid';

/**
 * 図を公開用の SVG にする。
 * スタイルテンプレートが付いた図は、エディタの公開と同じくそのスタイルで描く。
 * @param {string} id 図の ID
 * @param {string} [styleTemplate] スタイルテンプレートの ID。省略時は図の情報から取る
 */
export async function renderDiagramSVG(id, styleTemplate) {
  let style = styleTemplate;
  if (style === undefined) {
    const d = await GetDiagram(id);
    style = d?.styleTemplate || "";
  }
  if (style && !Mermaid.hasStyleTemplate(style)) {
    const content = await OpenTemplate(style).catch(() => "");
    Mermaid.setStyleTemplate(style, content);
  }
  const text = await OpenDiagram(id);
  const parsed = await ParseDiagram(id, false, text);
  if (parsed.error) throw new Error(parsed.error);
  const obj = await Mermaid.parse(parsed.html, style || undefined);
  return obj.svg;
}

/**
 * 公開する 1 件を GenerateAll に渡す形にする。
 * type は一覧・ツリーの種類（"note" / "diagram" / "asset" / "layer"）。
 * ノートは text を渡せばそれを使い、無ければ保存済みの本文を読む。
 * @param {{ id: string, type: string, styleTemplate?: string }} leaf
 * @param {string} [text] ノートの Markdown
 * @returns {Promise<{ mode: string, id: string, data: string }>}
 */
export async function renderPublishItem(leaf, text) {
  if (leaf.type === "note") {
    const src = text ?? await OpenNote(leaf.id);
    const parsed = await ParseNote(leaf.id, false, src);
    if (parsed.error) throw new Error(parsed.error);
    const html = await Marked.parse(parsed.html);
    return { mode: "note", id: leaf.id, data: html };
  }
  if (leaf.type === "diagram") {
    const svg = await renderDiagramSVG(leaf.id, leaf.styleTemplate);
    return { mode: "diagram", id: leaf.id, data: svg };
  }
  if (leaf.type === "layer") {
    return { mode: "layer", id: leaf.id, data: "" };
  }
  return { mode: "assets", id: leaf.id, data: "" };
}

// 記録のメッセージで使う見出し（未公開一覧の「Generate:」と同じ形）
const SECTIONS = [
  ["note", "Note"],
  ["diagram", "Diagram"],
  ["asset", "Asset"],
  ["layer", "Layer"],
];

/**
 * 記録のメッセージの、種類ごとの一覧の部分（先頭は改行）を作る。
 * @param {{ type: string, name: string }[]} leaves
 */
export function publishCommentLines(leaves) {
  let lines = "";
  for (const [type, label] of SECTIONS) {
    const list = leaves.filter((l) => l.type === type);
    if (list.length === 0) continue;
    lines += "\n  " + label + ":";
    list.forEach((l) => { lines += "\n    " + l.name; });
  }
  return lines;
}

/**
 * まとめて公開するときの記録のメッセージを作る。
 * @param {{ type: string, name: string }[]} leaves
 */
export function publishComment(leaves) {
  return "Generate:" + publishCommentLines(leaves);
}
