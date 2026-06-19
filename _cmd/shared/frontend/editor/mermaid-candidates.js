/**
 * Mermaid ダイアグラムタイプのオートコンプリート候補定義（Mermaid 11.x）
 *
 * detail はi18nリソースID。使用側で t() を通して解決する。
 */
export const mermaidDiagramCandidates = [
  { label: 'graph',             detail: 'autocomplete.mermaid.graph' },
  { label: 'flowchart',         detail: 'autocomplete.mermaid.flowchart' },
  { label: 'sequenceDiagram',   detail: 'autocomplete.mermaid.sequenceDiagram' },
  { label: 'classDiagram',      detail: 'autocomplete.mermaid.classDiagram' },
  { label: 'stateDiagram-v2',   detail: 'autocomplete.mermaid.stateDiagram' },
  { label: 'erDiagram',         detail: 'autocomplete.mermaid.erDiagram' },
  { label: 'gantt',             detail: 'autocomplete.mermaid.gantt' },
  { label: 'pie',               detail: 'autocomplete.mermaid.pie' },
  { label: 'gitGraph',          detail: 'autocomplete.mermaid.gitGraph' },
  { label: 'journey',           detail: 'autocomplete.mermaid.journey' },
  { label: 'mindmap',           detail: 'autocomplete.mermaid.mindmap' },
  { label: 'timeline',          detail: 'autocomplete.mermaid.timeline' },
  { label: 'quadrantChart',     detail: 'autocomplete.mermaid.quadrantChart' },
  { label: 'xychart-beta',      detail: 'autocomplete.mermaid.xychart' },
  { label: 'sankey-beta',       detail: 'autocomplete.mermaid.sankey' },
  { label: 'block-beta',        detail: 'autocomplete.mermaid.block' },
  { label: 'packet-beta',       detail: 'autocomplete.mermaid.packet' },
  { label: 'kanban',            detail: 'autocomplete.mermaid.kanban' },
  { label: 'architecture-beta', detail: 'autocomplete.mermaid.architecture' },
  { label: 'requirementDiagram', detail: 'autocomplete.mermaid.requirementDiagram' },
  { label: 'C4Context',         detail: 'autocomplete.mermaid.c4context' },
  { label: 'C4Container',       detail: 'autocomplete.mermaid.c4container' },
  { label: 'C4Component',       detail: 'autocomplete.mermaid.c4component' },
  { label: 'C4Dynamic',         detail: 'autocomplete.mermaid.c4dynamic' },
  { label: 'C4Deployment',      detail: 'autocomplete.mermaid.c4deployment' },
  { label: 'zenuml',            detail: 'autocomplete.mermaid.zenuml' },
];
