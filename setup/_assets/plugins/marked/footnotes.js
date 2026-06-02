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
//     数値ID[^1]も使えます。
//
//     [^go]: https://go.dev
//     [^1]: これが脚注テキストです。
//
(function() {
  var defs = {};
  var refs = [];

  return {
    hooks: {
      preprocess: function(src) {
        // renderごとに状態をリセット
        defs = {};
        refs = [];
        return src;
      },
      postprocess: function(html) {
        if (refs.length === 0) return html;
        var items = refs.map(function(id, i) {
          var text = defs[id] || id;
          return '<li id="fn-' + id + '" value="' + (i + 1) + '">'
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
        // Block: [^id]: 定義テキスト を空にレンダリングしつつ defs に保存する
        name: 'footnoteDefinition',
        level: 'block',
        start: function(src) {
          var m = src.match(/\[\^[^\]]+\]:/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\[\^([^\]]+)\]:\s+([^\n]+)\n?/);
          if (match) {
            var id = match[1].toLowerCase();
            defs[id] = match[2].trim();
            return {
              type: 'footnoteDefinition',
              raw: match[0],
              id: id,
            };
          }
        },
        renderer: function(token) {
          return '';
        }
      },
      {
        // Inline: [^id] を上付き参照リンクにレンダリングする
        name: 'footnoteRef',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\[\^[^\]]+\]/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\[\^([^\]]+)\]/);
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
