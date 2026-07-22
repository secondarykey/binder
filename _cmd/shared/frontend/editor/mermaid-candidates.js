/**
 * Mermaid ダイアグラムタイプの i18n マッピング。
 * キーはダイアグラムキーワード、値は i18n リソースID。
 */
export const mermaidKnownKeywords = [
  'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2',
  'erDiagram', 'gantt', 'pie', 'gitGraph', 'journey', 'mindmap', 'timeline',
  'quadrantChart', 'xychart-beta', 'sankey-beta', 'block-beta', 'packet-beta',
  'kanban', 'architecture-beta', 'requirementDiagram',
  'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment',
  'zenuml', 'radar-beta', 'treemap-beta', 'treeView-beta', 'wardley-beta',
  'ishikawa', 'venn',
  // mermaid 11.15/11.16 で追加
  'eventmodeling', 'cynefin-beta',
];

const mermaidI18nMap = {
  'graph':              'autocomplete.mermaid.graph',
  'flowchart':          'autocomplete.mermaid.flowchart',
  'sequenceDiagram':    'autocomplete.mermaid.sequenceDiagram',
  'classDiagram':       'autocomplete.mermaid.classDiagram',
  'stateDiagram-v2':    'autocomplete.mermaid.stateDiagram',
  'erDiagram':          'autocomplete.mermaid.erDiagram',
  'gantt':              'autocomplete.mermaid.gantt',
  'pie':                'autocomplete.mermaid.pie',
  'gitGraph':           'autocomplete.mermaid.gitGraph',
  'journey':            'autocomplete.mermaid.journey',
  'mindmap':            'autocomplete.mermaid.mindmap',
  'timeline':           'autocomplete.mermaid.timeline',
  'quadrantChart':      'autocomplete.mermaid.quadrantChart',
  'xychart-beta':       'autocomplete.mermaid.xychart',
  'sankey-beta':        'autocomplete.mermaid.sankey',
  'block-beta':         'autocomplete.mermaid.block',
  'packet-beta':        'autocomplete.mermaid.packet',
  'kanban':             'autocomplete.mermaid.kanban',
  'architecture-beta':  'autocomplete.mermaid.architecture',
  'requirementDiagram': 'autocomplete.mermaid.requirementDiagram',
  'C4Context':          'autocomplete.mermaid.c4context',
  'C4Container':        'autocomplete.mermaid.c4container',
  'C4Component':        'autocomplete.mermaid.c4component',
  'C4Dynamic':          'autocomplete.mermaid.c4dynamic',
  'C4Deployment':       'autocomplete.mermaid.c4deployment',
  'zenuml':             'autocomplete.mermaid.zenuml',
  'radar-beta':         'autocomplete.mermaid.radar',
  'treemap-beta':       'autocomplete.mermaid.treemap',
  'treeView-beta':      'autocomplete.mermaid.treeView',
  'wardley-beta':       'autocomplete.mermaid.wardley',
  'ishikawa':           'autocomplete.mermaid.ishikawa',
  'venn':               'autocomplete.mermaid.venn',
  'eventmodeling':      'autocomplete.mermaid.eventmodeling',
  'cynefin-beta':       'autocomplete.mermaid.cynefin',
};

/**
 * flowchart / graph の方向キーワード
 */
export const mermaidDirections = [
  { label: 'TD', detail: 'autocomplete.mermaid.dir.TD' },
  { label: 'TB', detail: 'autocomplete.mermaid.dir.TB' },
  { label: 'BT', detail: 'autocomplete.mermaid.dir.BT' },
  { label: 'LR', detail: 'autocomplete.mermaid.dir.LR' },
  { label: 'RL', detail: 'autocomplete.mermaid.dir.RL' },
];

/**
 * ダイアグラムタイプごとの構文キーワード候補。
 * キーはダイアグラムタイプ（複数タイプが同じ構文を共有する場合は配列で参照）。
 */
export const mermaidSyntaxKeywords = {
  flowchart: [
    { label: 'subgraph', detail: 'autocomplete.mermaid.syn.subgraph' },
    { label: 'end',      detail: 'autocomplete.mermaid.syn.end' },
    { label: 'direction', detail: 'autocomplete.mermaid.syn.direction' },
    { label: 'style',    detail: 'autocomplete.mermaid.syn.style' },
    { label: 'classDef', detail: 'autocomplete.mermaid.syn.classDef' },
    { label: 'class',    detail: 'autocomplete.mermaid.syn.class' },
    { label: 'click',    detail: 'autocomplete.mermaid.syn.click' },
    { label: 'linkStyle', detail: 'autocomplete.mermaid.syn.linkStyle' },
  ],
  sequenceDiagram: [
    { label: 'participant', detail: 'autocomplete.mermaid.syn.participant' },
    { label: 'actor',       detail: 'autocomplete.mermaid.syn.actor' },
    { label: 'activate',    detail: 'autocomplete.mermaid.syn.activate' },
    { label: 'deactivate',  detail: 'autocomplete.mermaid.syn.deactivate' },
    { label: 'Note left of',  detail: 'autocomplete.mermaid.syn.noteLeftOf' },
    { label: 'Note right of', detail: 'autocomplete.mermaid.syn.noteRightOf' },
    { label: 'Note over',     detail: 'autocomplete.mermaid.syn.noteOver' },
    { label: 'loop',        detail: 'autocomplete.mermaid.syn.loop' },
    { label: 'alt',         detail: 'autocomplete.mermaid.syn.alt' },
    { label: 'else',        detail: 'autocomplete.mermaid.syn.else' },
    { label: 'opt',         detail: 'autocomplete.mermaid.syn.opt' },
    { label: 'par',         detail: 'autocomplete.mermaid.syn.par' },
    { label: 'and',         detail: 'autocomplete.mermaid.syn.and' },
    { label: 'critical',    detail: 'autocomplete.mermaid.syn.critical' },
    { label: 'break',       detail: 'autocomplete.mermaid.syn.break' },
    { label: 'rect',        detail: 'autocomplete.mermaid.syn.rect' },
    { label: 'end',         detail: 'autocomplete.mermaid.syn.end' },
    { label: 'autonumber',  detail: 'autocomplete.mermaid.syn.autonumber' },
    { label: 'box',         detail: 'autocomplete.mermaid.syn.box' },
  ],
  classDiagram: [
    { label: 'class',        detail: 'autocomplete.mermaid.syn.classDef' },
    { label: 'namespace',    detail: 'autocomplete.mermaid.syn.namespace' },
    { label: 'note',         detail: 'autocomplete.mermaid.syn.note' },
    { label: 'direction',    detail: 'autocomplete.mermaid.syn.direction' },
    { label: '<<interface>>', detail: 'autocomplete.mermaid.syn.interface' },
    { label: '<<abstract>>',  detail: 'autocomplete.mermaid.syn.abstract' },
    { label: '<<enumeration>>', detail: 'autocomplete.mermaid.syn.enumeration' },
  ],
  'stateDiagram-v2': [
    { label: 'state',     detail: 'autocomplete.mermaid.syn.state' },
    { label: 'note left of',  detail: 'autocomplete.mermaid.syn.noteLeftOf' },
    { label: 'note right of', detail: 'autocomplete.mermaid.syn.noteRightOf' },
    { label: 'direction', detail: 'autocomplete.mermaid.syn.direction' },
    { label: '[*]',        detail: 'autocomplete.mermaid.syn.startEnd' },
  ],
  erDiagram: [
    { label: 'title', detail: 'autocomplete.mermaid.syn.title' },
  ],
  gantt: [
    { label: 'title',          detail: 'autocomplete.mermaid.syn.title' },
    { label: 'dateFormat',     detail: 'autocomplete.mermaid.syn.dateFormat' },
    { label: 'axisFormat',     detail: 'autocomplete.mermaid.syn.axisFormat' },
    { label: 'todayMarker',   detail: 'autocomplete.mermaid.syn.todayMarker' },
    { label: 'excludes',      detail: 'autocomplete.mermaid.syn.excludes' },
    { label: 'section',       detail: 'autocomplete.mermaid.syn.section' },
    { label: 'tickInterval',  detail: 'autocomplete.mermaid.syn.tickInterval' },
  ],
  pie: [
    { label: 'title',    detail: 'autocomplete.mermaid.syn.title' },
    { label: 'showData', detail: 'autocomplete.mermaid.syn.showData' },
  ],
  gitGraph: [
    { label: 'commit',      detail: 'autocomplete.mermaid.syn.commit' },
    { label: 'branch',      detail: 'autocomplete.mermaid.syn.branch' },
    { label: 'checkout',    detail: 'autocomplete.mermaid.syn.checkout' },
    { label: 'merge',       detail: 'autocomplete.mermaid.syn.merge' },
    { label: 'cherry-pick', detail: 'autocomplete.mermaid.syn.cherryPick' },
  ],
  journey: [
    { label: 'title',   detail: 'autocomplete.mermaid.syn.title' },
    { label: 'section', detail: 'autocomplete.mermaid.syn.section' },
  ],
  timeline: [
    { label: 'title',   detail: 'autocomplete.mermaid.syn.title' },
    { label: 'section', detail: 'autocomplete.mermaid.syn.section' },
  ],
  quadrantChart: [
    { label: 'title',           detail: 'autocomplete.mermaid.syn.title' },
    { label: 'x-axis',          detail: 'autocomplete.mermaid.syn.xAxis' },
    { label: 'y-axis',          detail: 'autocomplete.mermaid.syn.yAxis' },
    { label: 'quadrant-1',      detail: 'autocomplete.mermaid.syn.quadrant1' },
    { label: 'quadrant-2',      detail: 'autocomplete.mermaid.syn.quadrant2' },
    { label: 'quadrant-3',      detail: 'autocomplete.mermaid.syn.quadrant3' },
    { label: 'quadrant-4',      detail: 'autocomplete.mermaid.syn.quadrant4' },
  ],
  'xychart-beta': [
    { label: 'title',   detail: 'autocomplete.mermaid.syn.title' },
    { label: 'x-axis',  detail: 'autocomplete.mermaid.syn.xAxis' },
    { label: 'y-axis',  detail: 'autocomplete.mermaid.syn.yAxis' },
    { label: 'line',    detail: 'autocomplete.mermaid.syn.line' },
    { label: 'bar',     detail: 'autocomplete.mermaid.syn.bar' },
  ],
  requirementDiagram: [
    { label: 'requirement',           detail: 'autocomplete.mermaid.syn.requirement' },
    { label: 'functionalRequirement', detail: 'autocomplete.mermaid.syn.functionalReq' },
    { label: 'performanceRequirement', detail: 'autocomplete.mermaid.syn.performanceReq' },
    { label: 'interfaceRequirement',  detail: 'autocomplete.mermaid.syn.interfaceReq' },
    { label: 'physicalRequirement',   detail: 'autocomplete.mermaid.syn.physicalReq' },
    { label: 'designConstraint',      detail: 'autocomplete.mermaid.syn.designConstraint' },
    { label: 'element',               detail: 'autocomplete.mermaid.syn.element' },
  ],
};

// graph は flowchart と同じ構文
mermaidSyntaxKeywords['graph'] = mermaidSyntaxKeywords['flowchart'];

/**
 * 方向を持つダイアグラムタイプ（1行目でスペース後に方向候補を出す）
 */
export const mermaidDirectionTypes = new Set(['flowchart', 'graph']);

/**
 * Mermaid ライブラリから動的に取得したダイアグラムタイプ一覧を
 * オートコンプリート候補形式に変換する。
 *
 * @param {string[]} types - Mermaid.getDiagramTypes() の結果
 * @param {(key: string) => string} t - i18n 翻訳関数
 * @returns {Array<{ label: string, detail: string }>}
 */
export function buildMermaidCandidates(types, t) {
  return types.map(id => ({
    label: id,
    detail: t(mermaidI18nMap[id] || id),
  }));
}

/**
 * i18n を適用した構文キーワード候補マップを構築する。
 *
 * @param {(key: string) => string} t - i18n 翻訳関数
 * @returns {Object<string, Array<{ label: string, detail: string }>>}
 */
export function buildMermaidSyntaxMap(t) {
  const result = {};
  for (const [type, keywords] of Object.entries(mermaidSyntaxKeywords)) {
    result[type] = keywords.map(k => ({ ...k, detail: t(k.detail) }));
  }
  return result;
}

/**
 * i18n を適用した方向キーワード候補を構築する。
 *
 * @param {(key: string) => string} t - i18n 翻訳関数
 * @returns {Array<{ label: string, detail: string }>}
 */
export function buildMermaidDirections(t) {
  return mermaidDirections.map(d => ({ ...d, detail: t(d.detail) }));
}
