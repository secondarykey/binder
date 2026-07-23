/* @plugin-name: Subscript (~text~) */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
//
// ~テキスト~ を <sub> タグに変換する。
// ~~打ち消し線~~ との競合を避けるため、~~ は対象外。
// 中身は inline トークンとして解釈し、特殊文字を自動エスケープする。
//
// 使い方:
//   H~2~O
//   CO~2~
//
(function() {
  return {
    extensions: [
      {
        name: 'subscript',
        level: 'inline',
        start: function(src) {
          var m = src.match(/~(?!~)/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          // ~text~ にマッチ。~~ は除外
          var match = src.match(/^~(?!~)([^~\n\s][^~\n]*)~(?!~)/);
          if (match) {
            var token = {
              type: 'subscript',
              raw: match[0],
              text: match[1],
              tokens: [],
            };
            this.lexer.inline(token.text, token.tokens);
            return token;
          }
        },
        renderer: function(token) {
          return '<sub>' + this.parser.parseInline(token.tokens) + '</sub>';
        }
      }
    ]
  };
})();
