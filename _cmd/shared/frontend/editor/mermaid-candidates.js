/**
 * Mermaid ダイアグラムタイプの i18n マッピング。
 * キーはダイアグラムキーワード、値は i18n リソースID。
 */
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
};

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
