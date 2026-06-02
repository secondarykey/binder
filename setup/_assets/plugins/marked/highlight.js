/* @plugin-name: Highlight (==text==) */
//
// ==テキスト== を <mark> タグに変換する。
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
            return {
              type: 'highlight',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<mark>' + token.text + '</mark>';
        }
      }
    ]
  };
})();
