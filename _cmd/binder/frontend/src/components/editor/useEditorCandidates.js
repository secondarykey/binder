import { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { GetBinderTree } from "../../../bindings/binder/api/app";
import Mermaid from "./engines/Mermaid.jsx";
import { goTemplateCandidates, dotTopLevelCandidates, dotThisNoteFields, dotThisDiagramFields, dotHomeFields, dotNoteFields, dotDiagramFields } from "@shared/editor/go-template-candidates";
import { buildMermaidCandidates, buildMermaidSyntaxMap, buildMermaidDirections, mermaidKnownKeywords, mermaidDirectionTypes } from "@shared/editor/mermaid-candidates";
import { detectTemplateFunc } from "@shared/editor/template-detect";
import { flattenStructures, sortIdCandidates } from "./tree-flatten";
import { Mode } from "../../mode";

/**
 * オートコンプリートの候補を作る。
 *
 * - ダイアグラム: 行頭で Mermaid の図の種類・向き・構文
 * - それ以外: `{{` でテンプレート関数、`.` でフィールド、`"` で ID（関数の引数が ID のとき）
 *
 * 候補は textarea（#editor）の今の中身とカーソル位置から決める。
 *
 * @param {object} opts
 * @param {string} opts.mode 開いているものの種類
 * @param {string} opts.id 開いているものの ID（ID 候補から自分を外す）
 * @param {object} opts.autoComplete 補完の設定（template / idAssist / mermaid）
 * @param {Function} opts.t 翻訳
 * @returns {{ resolvedCandidates: Array, autocompleteTriggers: Array }}
 *   resolvedCandidates は説明を翻訳済みのテンプレート関数（関数ヒントでも使う）、
 *   autocompleteTriggers は useAutocomplete に渡す
 */
export function useEditorCandidates({ mode, id, autoComplete, t }) {

  const resolveI18n = useCallback((arr) =>
    arr.map(c => ({ ...c, detail: t(c.detail) })), [t]);

  const resolvedCandidates = useMemo(() => resolveI18n(goTemplateCandidates), [resolveI18n]);
  const [mermaidTypeCandidates, setMermaidTypeCandidates] = useState([]);
  const mermaidSyntaxMapRef = useRef({});
  const mermaidDirectionsRef = useRef([]);
  useEffect(() => {
    mermaidSyntaxMapRef.current = buildMermaidSyntaxMap(t);
    mermaidDirectionsRef.current = buildMermaidDirections(t);
    Mermaid.getDiagramTypes(mermaidKnownKeywords).then(types => {
      setMermaidTypeCandidates(buildMermaidCandidates(types, t));
    }).catch(() => {});
  }, [t]);

  const getMermaidCandidates = useCallback((filterText) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return mermaidTypeCandidates;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = text.substring(0, cursorPos);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const isFirstLine = lineStart === 0;

    if (isFirstLine) {
      const parts = filterText.split(/\s+/);
      if (parts.length >= 2) {
        const diagramType = parts[0];
        if (mermaidDirectionTypes.has(diagramType)) {
          return { items: mermaidDirectionsRef.current, filterKey: parts[parts.length - 1] };
        }
        return [];
      }
      return mermaidTypeCandidates;
    }

    const firstLine = text.substring(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length).trim();
    const diagramType = firstLine.split(/\s+/)[0];
    const syntaxItems = mermaidSyntaxMapRef.current[diagramType];
    if (syntaxItems) return syntaxItems;
    return [];
  }, [mermaidTypeCandidates]);

  const resolvedDotTopLevel = useMemo(() => resolveI18n(dotTopLevelCandidates), [resolveI18n]);
  const resolvedDotHome = useMemo(() => resolveI18n(dotHomeFields), [resolveI18n]);
  const resolvedDotNote = useMemo(() => resolveI18n(dotNoteFields), [resolveI18n]);
  const resolvedDotDiagram = useMemo(() => resolveI18n(dotDiagramFields), [resolveI18n]);
  const resolvedDotThisNote = useMemo(() => resolveI18n(dotThisNoteFields), [resolveI18n]);
  const resolvedDotThisDiagram = useMemo(() => resolveI18n(dotThisDiagramFields), [resolveI18n]);

  const resolvedDotThis = mode === Mode.diagram ? resolvedDotThisDiagram : resolvedDotThisNote;

  const dotFieldMap = useMemo(() => ({
    Home: resolvedDotHome,
    This: resolvedDotThis,
    Note: resolvedDotNote,
    Diagram: resolvedDotDiagram,
  }), [resolvedDotHome, resolvedDotThis, resolvedDotNote, resolvedDotDiagram]);

  const getDotCandidates = useCallback(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return [];
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const before = text.substring(0, cursorPos);
    const openIdx = before.lastIndexOf('{{');
    if (openIdx === -1) return [];
    if (before.substring(openIdx + 2).includes('}}')) return [];
    const lastDotIdx = before.lastIndexOf('.');
    if (lastDotIdx <= openIdx) return [];
    const beforeDot = before.substring(0, lastDotIdx);
    const prevDotIdx = beforeDot.lastIndexOf('.');
    if (prevDotIdx <= openIdx) return resolvedDotTopLevel;
    const parentToken = beforeDot.substring(prevDotIdx + 1).trim();
    return dotFieldMap[parentToken] || [];
  }, [resolvedDotTopLevel, dotFieldMap]);

  const getIdCandidates = useCallback(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return [];
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const result = detectTemplateFunc(text, cursorPos);
    if (!result || result.argIndex < 0) return [];
    let candidate = goTemplateCandidates.find(c => c.label === result.name);
    if (!candidate) return [];
    let argIndex = result.argIndex;
    if (candidate.needsEnd && argIndex >= 1 && result.tokens?.length > 0) {
      const innerName = result.tokens[0];
      const innerCandidate = goTemplateCandidates.find(c => c.label === innerName);
      if (innerCandidate?.args) {
        candidate = innerCandidate;
        argIndex = argIndex - 1;
      }
    }
    if (!candidate.args) return [];
    const arg = candidate.args[argIndex];
    if (!arg || !arg.idType) return [];
    const types = arg.idType.split(',');
    return GetBinderTree().then((tree) => {
      const all = flattenStructures(tree.data || []);
      const filtered = all.filter(s => types.includes(s.type));
      // ID挿入メニューと同じ並び（子を優先し、更新日付の降順）
      return sortIdCandidates(filtered, id).map(s => ({
        label: s.name || s.id,
        detail: s.type,
        insertText: s.id,
      }));
    }).catch(() => []);
  }, [id]);

  const getTemplateCandidates = useCallback((filterText) => {
    const trimmed = (filterText || '').trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const keyword = parts[0];
      const isBlock = goTemplateCandidates.some(c => c.label === keyword && c.needsEnd);
      if (isBlock) {
        const items = resolvedCandidates.filter(c =>
          !c.needsEnd && c.label !== 'end' && c.label !== 'else' && c.label !== 'else if'
        );
        return { items, filterKey: parts[parts.length - 1] };
      }
    }
    return resolvedCandidates;
  }, [resolvedCandidates]);

  const autocompleteTriggers = useMemo(() => {
    if (mode === Mode.diagram) {
      if (!autoComplete.mermaid) return [];
      return [{ trigger: '', lineStart: true, candidates: getMermaidCandidates }];
    }
    const triggers = [];
    if (autoComplete.template) {
      triggers.push({ trigger: '{{', candidates: getTemplateCandidates });
      triggers.push({ trigger: '.', candidates: getDotCandidates });
    }
    if (autoComplete.idAssist) {
      triggers.push({ trigger: '"', candidates: getIdCandidates });
    }
    return triggers;
  }, [autoComplete, mode, getMermaidCandidates, getTemplateCandidates, getDotCandidates, getIdCandidates]);

  return { resolvedCandidates, autocompleteTriggers };
}
