/* @plugin-name: Footnotes */
//
// 脚注記法を追加する。
//
// 使い方:
//   本文中で [^id] と書くと脚注参照になる。
//   ドキュメントの任意の場所に [^id]: 本文 と書くと脚注定義になる。
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
        // 脚注定義 [^id]: text を抽出して除去
        src = src.replace(/^\[\^([^\]]+)\]:\s+(.+)$/gm, function(_, id, text) {
          defs[id.toLowerCase()] = text.trim();
          return '';
        });
        return src;
      },
      postprocess: function(html) {
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
