/* @plugin-name: Underline (++text++) */
//
// ++テキスト++ を <ins> タグ（下線）に変換する。
// 追記・挿入テキストの表現に使う。
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
            return {
              type: 'underline',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<ins>' + token.text + '</ins>';
        }
      }
    ]
  };
})();
