/* @plugin-name: Keyboard Tag ([[Key]]) */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
//
// [[キー]] を <kbd> タグに変換する。
//
// 使い方:
//   [[Ctrl+C]] でコピー、[[Ctrl+V]] でペースト。
//   [[Enter]] を押して確定する。
//
// 中身は inline トークンとして解釈するため、特殊文字は自動エスケープされ、
// [[**Enter**]] のような強調も反映される（marked のバージョン差にも影響されない）。
//
(function() {
  return {
    extensions: [
      {
        name: 'kbd',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\[\[/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\[\[([^\]]+)\]\]/);
          if (match) {
            var token = {
              type: 'kbd',
              raw: match[0],
              text: match[1],
              tokens: [],
            };
            this.lexer.inline(token.text, token.tokens);
            return token;
          }
        },
        renderer: function(token) {
          return '<kbd>' + this.parser.parseInline(token.tokens) + '</kbd>';
        }
      }
    ]
  };
})();
