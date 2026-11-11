import { OpenNote, ParseNote, CreateTemplateHTML } from "../../../bindings/binder/api/app";
import Marked from "./engines/Marked.jsx";

// プレビューを作るときの、エディタの状態に依らない処理。

const mermaidErrorLineRe = /on line (\d+)/i;

export function extractMermaidErrorLine(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const m = mermaidErrorLineRe.exec(msg);
  if (m) return parseInt(m[1], 10);
  if (/UnknownDiagramError|No diagram type detected/i.test(msg)) return 1;
  return 0;
}

/**
 * テンプレートプレビューHTMLを生成する
 */
export async function runTemplatePreview(templateId, templateType, otherTemplateId, noteId) {
  const content = await OpenNote(noteId);
  const parseResult = await ParseNote(noteId, true, content);
  if (parseResult.error) return parseResult;
  const marked = await Marked.parse(parseResult.html);
  const templateResult = await CreateTemplateHTML(templateId, templateType, otherTemplateId, noteId, marked);
  templateResult.warnings = [...(parseResult.warnings || []), ...(templateResult.warnings || [])];
  return templateResult;
}
