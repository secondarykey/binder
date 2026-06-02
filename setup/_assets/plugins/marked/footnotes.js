/* @plugin-name: Footnotes */
//
// 脚注記法を追加する。
//
// 書き方:
//   本文中に [^id] と書く（参照）
//   行頭に [^id]: テキスト と書く（定義）
//
//   例:
//     Go言語[^go]はGoogleが開発した言語です。
//
//     [^go]: https://go.dev
//
(function() {
  var defs = {};
  var refs = [];

  return {
    hooks: {
      preprocess: function(src) {
        defs = {};
        refs = [];
        src = src.replace(/^\[\^([^\]]+)\]:\s+(.+)$/gm, function(_, id, text) {
          defs[id.toLowerCase()] = text.trim();
          return '';
        });
        console.info('[footnotes] defs:', defs);
        return src;
      },
      postprocess: function(html) {
        console.info('[footnotes] refs:', refs, 'defs:', defs);
        if (refs.length === 0) return html;
        var items = refs.map(function(id, i) {
          var n = i + 1;
          var text = defs[id] || id;
          return '<li id="fn-' + id + '" value="' + n + '">'
            + text
            + ' <a href="#fnref-' + id + '" class="footnote-backref">&#8617;</a>'
            + '</li>';
        });
        return html
          + '<hr>\n'
          + '<ol class="footnotes">\n'
          + items.join('\n')
          + '\n</ol>\n';
      }
    },
    extensions: [
      {
        name: 'footnoteRef',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\[\^[^\]]+\](?!\:)/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\[\^([^\]]+)\](?!\:)/);
          if (match) {
            return {
              type: 'footnoteRef',
              raw: match[0],
              id: match[1].toLowerCase(),
            };
          }
        },
        renderer: function(token) {
          var id = token.id;
          console.info('[footnotes] renderer called for id:', id);
          if (refs.indexOf(id) === -1) refs.push(id);
          var n = refs.indexOf(id) + 1;
          return '<sup id="fnref-' + id + '">'
            + '<a href="#fn-' + id + '">[' + n + ']</a>'
            + '</sup>';
        }
      }
    ]
  };
})();
