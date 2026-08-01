/* @plugin-name: Highlight (==text==) */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
//
// ==テキスト== を <mark> タグに変換する。
// 中身は inline トークンとして解釈し、特殊文字を自動エスケープする。
//
// 使い方:
//   これは ==重要な箇所== です。
//
(function() {
  return {
    extensions: [
      {
        name: 'highlight',
        level: 'inline',
        start: function(src) {
          var m = src.match(/==[^=]/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^==([^=]+)==/);
          if (match) {
            var token = {
              type: 'highlight',
              raw: match[0],
              text: match[1],
              tokens: [],
            };
            this.lexer.inline(token.text, token.tokens);
            return token;
          }
        },
        renderer: function(token) {
          return '<mark>' + this.parser.parseInline(token.tokens) + '</mark>';
        }
      }
    ]
  };
})();
