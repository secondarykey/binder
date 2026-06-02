/* @plugin-name: Keyboard Tag ([[Key]]) */
//
// [[キー]] を <kbd> タグに変換する。
//
// 使い方:
//   [[Ctrl+C]] でコピー、[[Ctrl+V]] でペースト。
//   [[Enter]] を押して確定する。
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
            return {
              type: 'kbd',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<kbd>' + token.text + '</kbd>';
        }
      }
    ]
  };
})();
