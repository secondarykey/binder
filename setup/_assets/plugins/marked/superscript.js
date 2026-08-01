/* @plugin-name: Superscript (^text^) */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
//
// ^テキスト^ を <sup> タグに変換する。
// 中身は inline トークンとして解釈し、特殊文字を自動エスケープする。
//
// 使い方:
//   x^2^ + y^2^ = r^2^
//   10^9^ バイト
//
(function() {
  return {
    extensions: [
      {
        name: 'superscript',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\^[^\^\s]/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\^([^\^\s][^\^]*)\^/);
          if (match) {
            var token = {
              type: 'superscript',
              raw: match[0],
              text: match[1],
              tokens: [],
            };
            this.lexer.inline(token.text, token.tokens);
            return token;
          }
        },
        renderer: function(token) {
          return '<sup>' + this.parser.parseInline(token.tokens) + '</sup>';
        }
      }
    ]
  };
})();
