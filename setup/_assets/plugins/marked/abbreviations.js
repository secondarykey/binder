/* @plugin-name: Abbreviations (*[ABBR]: definition) */
//
// 略語定義を登録し、本文中の一致箇所を <abbr> タグに変換する。
// ホバーすると定義が表示される。
//
// 使い方:
//   HTMLとCSSは便利です。
//
//   *[HTML]: HyperText Markup Language
//   *[CSS]: Cascading Style Sheets
//
(function() {
  var abbrs = {};

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return {
    hooks: {
      preprocess: function(src) {
        abbrs = {};
        return src;
      },
      postprocess: function(html) {
        if (!abbrs || Object.keys(abbrs).length === 0) return html;

        // <code> / <pre> 内は変換しない
        var parts = html.split(/(<\/?(?:code|pre)[^>]*>)/);
        var inCode = false;
        var result = '';

        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];
          if (/^<(?:code|pre)/.test(part)) {
            inCode = true;
            result += part;
          } else if (/^<\/(?:code|pre)/.test(part)) {
            inCode = false;
            result += part;
          } else if (inCode) {
            result += part;
          } else {
            // タグ外のテキスト部分のみ置換
            result += part.replace(/>([^<]*)</g, function(m, text) {
              Object.keys(abbrs).forEach(function(abbr) {
                var re = new RegExp('\\b' + escapeRegex(abbr) + '\\b', 'g');
                text = text.replace(re, '<abbr title="' + abbrs[abbr] + '">' + abbr + '</abbr>');
              });
              return '>' + text + '<';
            });
          }
        }
        return result;
      }
    },
    extensions: [
      {
        name: 'abbreviationDef',
        level: 'block',
        start: function(src) {
          var m = src.match(/^\*\[[^\]]+\]:/m);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\*\[([^\]]+)\]:\s+([^\n]+)\n?/);
          if (match) {
            abbrs[match[1].trim()] = match[2].trim();
            return {
              type: 'abbreviationDef',
              raw: match[0],
            };
          }
        },
        renderer: function() {
          return '';
        }
      }
    ]
  };
})();
