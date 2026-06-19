/**
 * Go テンプレートのオートコンプリート候補定義
 *
 * detail はi18nリソースID。使用側で t() を通して解決する。
 * args / returns は将来の引数ヒント表示用（現時点では未使用）。
 */
export const goTemplateCandidates = [
  // Keywords
  { label: 'if',       detail: 'autocomplete.if',       category: 'keyword' },
  { label: 'else',     detail: 'autocomplete.else',     category: 'keyword' },
  { label: 'else if',  detail: 'autocomplete.elseIf',   category: 'keyword' },
  { label: 'range',    detail: 'autocomplete.range',    category: 'keyword' },
  { label: 'with',     detail: 'autocomplete.with',     category: 'keyword' },
  { label: 'end',      detail: 'autocomplete.end',      category: 'keyword' },

  // Control flow
  { label: 'break',    detail: 'autocomplete.break',    category: 'control' },
  { label: 'continue', detail: 'autocomplete.continue', category: 'control' },

  // Actions
  { label: 'define',   detail: 'autocomplete.define',   category: 'action' },
  { label: 'template', detail: 'autocomplete.template', category: 'action' },
  { label: 'block',    detail: 'autocomplete.block',    category: 'action' },

  // Comparison functions
  { label: 'eq', detail: 'autocomplete.eq', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },
  { label: 'ne', detail: 'autocomplete.ne', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },
  { label: 'lt', detail: 'autocomplete.lt', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },
  { label: 'le', detail: 'autocomplete.le', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },
  { label: 'gt', detail: 'autocomplete.gt', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },
  { label: 'ge', detail: 'autocomplete.ge', category: 'comparison', args: [{ name: 'a', type: 'any' }, { name: 'b', type: 'any' }], returns: 'bool' },

  // Built-in functions
  { label: 'and',      detail: 'autocomplete.and',      category: 'function', args: [{ name: 'x', type: 'any' }, { name: 'y...', type: 'any' }], returns: 'any' },
  { label: 'or',       detail: 'autocomplete.or',       category: 'function', args: [{ name: 'x', type: 'any' }, { name: 'y...', type: 'any' }], returns: 'any' },
  { label: 'not',      detail: 'autocomplete.not',      category: 'function', args: [{ name: 'x', type: 'any' }], returns: 'bool' },
  { label: 'len',      detail: 'autocomplete.len',      category: 'function', args: [{ name: 'collection', type: 'any' }], returns: 'int' },
  { label: 'index',    detail: 'autocomplete.index',    category: 'function', args: [{ name: 'collection', type: 'any' }, { name: 'key...', type: 'any' }], returns: 'any' },
  { label: 'slice',    detail: 'autocomplete.slice',    category: 'function', args: [{ name: 'collection', type: 'any' }, { name: 'begin', type: 'int' }, { name: 'end?', type: 'int' }], returns: 'any' },
  { label: 'call',     detail: 'autocomplete.call',     category: 'function', args: [{ name: 'fn', type: 'function' }, { name: 'args...', type: 'any' }], returns: 'any' },
  { label: 'print',    detail: 'autocomplete.print',    category: 'function', args: [{ name: 'args...', type: 'any' }], returns: 'string' },
  { label: 'println',  detail: 'autocomplete.println',  category: 'function', args: [{ name: 'args...', type: 'any' }], returns: 'string' },
  { label: 'printf',   detail: 'autocomplete.printf',   category: 'function', args: [{ name: 'format', type: 'string' }, { name: 'args...', type: 'any' }], returns: 'string' },
  { label: 'html',     detail: 'autocomplete.html',     category: 'function', args: [{ name: 'text', type: 'string' }], returns: 'string' },
  { label: 'js',       detail: 'autocomplete.js',       category: 'function', args: [{ name: 'text', type: 'string' }], returns: 'string' },
  { label: 'urlquery', detail: 'autocomplete.urlquery', category: 'function', args: [{ name: 'text', type: 'string' }], returns: 'string' },

  // Binder custom functions (defineFuncMap)
  { label: 'embed',        detail: 'autocomplete.embed',        category: 'binder', args: [{ name: 'id', type: 'string', idType: 'note,asset' }], returns: 'HTML' },
  { label: 'drawDiagram',  detail: 'autocomplete.drawDiagram',  category: 'binder', args: [{ name: 'id', type: 'string', idType: 'diagram' }, { name: 'class?', type: 'string' }], returns: 'HTML' },
  { label: 'drawLayer',    detail: 'autocomplete.drawLayer',    category: 'binder', args: [{ name: 'id', type: 'string', idType: 'layer' }, { name: 'class?', type: 'string' }], returns: 'HTML' },
  { label: 'assets',       detail: 'autocomplete.assets',       category: 'binder', args: [{ name: 'id', type: 'string', idType: 'asset' }], returns: 'URL' },
  { label: 'assetsImage',  detail: 'autocomplete.assetsImage',  category: 'binder', args: [{ name: 'id', type: 'string', idType: 'asset' }], returns: 'HTML' },
  { label: 'childNotes',    detail: 'autocomplete.childNotes',    category: 'binder', args: [{ name: 'n?', type: 'int' }, { name: 'id?', type: 'string', idType: 'note' }, { name: 'order?', type: 'string' }], returns: '[]Note' },
  { label: 'childrenNotes', detail: 'autocomplete.childNotes', category: 'binder', args: [{ name: 'n?', type: 'int' }, { name: 'id?', type: 'string', idType: 'note' }, { name: 'order?', type: 'string' }], returns: '[]Note', deprecated: true },
  { label: 'latestNotes',  detail: 'autocomplete.latestNotes',  category: 'binder', args: [{ name: 'n', type: 'int' }], returns: '[]Note' },
  { label: 'breadcrumb',   detail: 'autocomplete.breadcrumb',   category: 'binder', args: [], returns: '[]Note' },
  { label: 'safe',         detail: 'autocomplete.safe',         category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'string' },
  { label: 'lit',          detail: 'autocomplete.lit',          category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'HTML' },
  { label: 'litURL',       detail: 'autocomplete.litURL',       category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'URL' },
  { label: 'replace',      detail: 'autocomplete.replace',      category: 'binder', args: [{ name: 's', type: 'string' }, { name: 'old', type: 'string' }, { name: 'new', type: 'string' }], returns: 'string' },
  { label: 'localeDate',   detail: 'autocomplete.localeDate',   category: 'binder', args: [{ name: 'date', type: 'string' }], returns: 'HTML' },
  { label: 'formatDate',   detail: 'autocomplete.formatDate',   category: 'binder', args: [{ name: 'date', type: 'string' }, { name: 'format', type: 'string' }], returns: 'string' },
  { label: 'lf2br',        detail: 'autocomplete.lf2br',        category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'string' },
  { label: 'lf2sp',        detail: 'autocomplete.lf2sp',        category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'string' },
  { label: 'lf2comma',     detail: 'autocomplete.lf2comma',     category: 'binder', args: [{ name: 'src', type: 'string' }], returns: 'string' },
];

/**
 * ドットアクセサのオートコンプリート候補定義。
 * テンプレートに渡される DTO 構造体のフィールド情報。
 */
export const dotTopLevelCandidates = [
  { label: 'Home',    detail: 'autocomplete.dotHome',    category: 'dotField', returns: 'object' },
  { label: 'This',    detail: 'autocomplete.dotThis',    category: 'dotField', returns: 'object' },
  { label: 'Marked',  detail: 'autocomplete.dotMarked',  category: 'dotField', returns: 'HTML' },
  { label: 'Note',    detail: 'autocomplete.dotNote',    category: 'dotField', returns: 'object', deprecated: true },
  { label: 'Diagram', detail: 'autocomplete.dotDiagram', category: 'dotField', returns: 'object', deprecated: true },
];

export const dotThisNoteFields = [
  { label: 'Id',      detail: 'autocomplete.dotNoteId',      category: 'dotField', returns: 'string' },
  { label: 'Name',    detail: 'autocomplete.dotNoteName',    category: 'dotField', returns: 'string' },
  { label: 'Detail',  detail: 'autocomplete.dotNoteDetail',  category: 'dotField', returns: 'string' },
  { label: 'Publish', detail: 'autocomplete.dotNotePublish', category: 'dotField', returns: 'string' },
  { label: 'Updated', detail: 'autocomplete.dotNoteUpdated', category: 'dotField', returns: 'string' },
  { label: 'Created', detail: 'autocomplete.dotNoteCreated', category: 'dotField', returns: 'string' },
  { label: 'Link',    detail: 'autocomplete.dotNoteLink',    category: 'dotField', returns: 'string' },
  { label: 'Image',   detail: 'autocomplete.dotNoteImage',   category: 'dotField', returns: 'URL' },
];

export const dotThisDiagramFields = [
  { label: 'Id',      detail: 'autocomplete.dotDiagramId',      category: 'dotField', returns: 'string' },
  { label: 'Name',    detail: 'autocomplete.dotDiagramName',    category: 'dotField', returns: 'string' },
  { label: 'Detail',  detail: 'autocomplete.dotDiagramDetail',  category: 'dotField', returns: 'string' },
  { label: 'Alias',   detail: 'autocomplete.dotDiagramAlias',   category: 'dotField', returns: 'string' },
  { label: 'Publish', detail: 'autocomplete.dotDiagramPublish', category: 'dotField', returns: 'string' },
  { label: 'Created', detail: 'autocomplete.dotDiagramCreated', category: 'dotField', returns: 'string' },
  { label: 'Updated', detail: 'autocomplete.dotDiagramUpdated', category: 'dotField', returns: 'string' },
];

export const dotHomeFields = [
  { label: 'Name',   detail: 'autocomplete.dotHomeName',   category: 'dotField', returns: 'string' },
  { label: 'Detail', detail: 'autocomplete.dotHomeDetail', category: 'dotField', returns: 'string' },
  { label: 'Link',   detail: 'autocomplete.dotHomeLink',   category: 'dotField', returns: 'string' },
];

export const dotNoteFields = [
  { label: 'Id',      detail: 'autocomplete.dotNoteId',      category: 'dotField', returns: 'string' },
  { label: 'Name',    detail: 'autocomplete.dotNoteName',    category: 'dotField', returns: 'string' },
  { label: 'Detail',  detail: 'autocomplete.dotNoteDetail',  category: 'dotField', returns: 'string' },
  { label: 'Publish', detail: 'autocomplete.dotNotePublish', category: 'dotField', returns: 'string' },
  { label: 'Updated', detail: 'autocomplete.dotNoteUpdated', category: 'dotField', returns: 'string' },
  { label: 'Created', detail: 'autocomplete.dotNoteCreated', category: 'dotField', returns: 'string' },
  { label: 'Link',    detail: 'autocomplete.dotNoteLink',    category: 'dotField', returns: 'string' },
  { label: 'Image',   detail: 'autocomplete.dotNoteImage',   category: 'dotField', returns: 'URL' },
];

export const dotDiagramFields = [
  { label: 'Id',      detail: 'autocomplete.dotDiagramId',      category: 'dotField', returns: 'string' },
  { label: 'Name',    detail: 'autocomplete.dotDiagramName',    category: 'dotField', returns: 'string' },
  { label: 'Detail',  detail: 'autocomplete.dotDiagramDetail',  category: 'dotField', returns: 'string' },
  { label: 'Alias',   detail: 'autocomplete.dotDiagramAlias',   category: 'dotField', returns: 'string' },
  { label: 'Publish', detail: 'autocomplete.dotDiagramPublish', category: 'dotField', returns: 'string' },
  { label: 'Created', detail: 'autocomplete.dotDiagramCreated', category: 'dotField', returns: 'string' },
  { label: 'Updated', detail: 'autocomplete.dotDiagramUpdated', category: 'dotField', returns: 'string' },
];
