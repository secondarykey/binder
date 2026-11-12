/* @plugin-name: Underline (++text++) */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
//
// ++テキスト++ を <ins> タグ（下線）に変換する。
// 追記・挿入テキストの表現に使う。
// 中身は inline トークンとして解釈し、特殊文字を自動エスケープする。
//
// 使い方:
//   これは ++追加されたテキスト++ です。
//
(function() {
  return {
    extensions: [
      {
        name: 'underline',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\+\+(?!\s)/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\+\+(?!\s)([\s\S]+?)(?<!\s)\+\+/);
          if (match) {
            var token = {
              type: 'underline',
              raw: match[0],
              text: match[1],
              tokens: [],
            };
            this.lexer.inline(token.text, token.tokens);
            return token;
          }
        },
        renderer: function(token) {
          return '<ins>' + this.parser.parseInline(token.tokens) + '</ins>';
        }
      }
    ]
  };
})();
