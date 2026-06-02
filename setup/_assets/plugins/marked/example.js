/* @plugin-name: Example Plugin */
//
// Binder Marked Plugin Template
//
// Copy this file to your binder's plugins/ directory and customize it.
// The returned object is passed directly to marked.use().
// See: https://marked.js.org/using_advanced#extensions
//
// Multiple plugins can coexist. Files are loaded alphabetically.
// Use numeric prefixes for ordering: 01-alerts.js, 02-footnotes.js
//
// Available options:
//   extensions: [{ name, level, start, tokenizer, renderer }]
//   renderer:   { heading(token){}, link(token){}, ... }
//   hooks:      { preprocess(md){}, postprocess(html){} }
//   walkTokens: function(token) { ... }
//
(function() {
  return {
    // example: override heading renderer
    // renderer: {
    //   heading({ tokens, depth }) {
    //     const text = this.parser.parseInline(tokens);
    //     return `<h${depth} class="custom">${text}</h${depth}>`;
    //   }
    // }
  };
})();
