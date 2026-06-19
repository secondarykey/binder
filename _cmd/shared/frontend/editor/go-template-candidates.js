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
];
