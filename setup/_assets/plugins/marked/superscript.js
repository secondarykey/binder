/* @plugin-name: Superscript (^text^) */
//
// ^テキスト^ を <sup> タグに変換する。
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
            return {
              type: 'superscript',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<sup>' + token.text + '</sup>';
        }
      }
    ]
  };
})();
