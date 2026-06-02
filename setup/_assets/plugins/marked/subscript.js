/* @plugin-name: Subscript (~text~) */
//
// ~テキスト~ を <sub> タグに変換する。
// ~~打ち消し線~~ との競合を避けるため、~~ は対象外。
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
            return {
              type: 'subscript',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<sub>' + token.text + '</sub>';
        }
      }
    ]
  };
})();
