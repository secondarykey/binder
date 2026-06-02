/* @plugin-name: Custom Containers (:::type) */
//
// ::: で囲んだブロックを汎用コンテナに変換する。
// GitHub Alerts より汎用的で、任意のタイプとタイトルを指定できる。
//
// 使い方:
//   ::: warning 注意
//   この操作は元に戻せません。
//   :::
//
//   ::: info
//   タイトルなしも可能です。
//   :::
//
// よく使うタイプ: info / warning / danger / tip / note / success
//
// CSS クラス: .container .container-{type} .container-title
//
(function() {
  return {
    extensions: [
      {
        name: 'container',
        level: 'block',
        start: function(src) {
          var m = src.match(/^:{3}/m);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          // :::type タイトル\n内容\n::: にマッチ
          var match = src.match(/^:{3}(\w*)\s*([^\n]*)\n([\s\S]*?)\n:{3}[ \t]*(?:\n|$)/);
          if (!match) return;

          var type = (match[1] || 'info').toLowerCase();
          var title = match[2].trim();
          var body = match[3];

          return {
            type: 'container',
            raw: match[0],
            containerType: type,
            title: title,
            tokens: this.lexer.blockTokens(body),
          };
        },
        childTokens: ['tokens'],
        renderer: function(token) {
          var content = this.parser.parse(token.tokens);
          var titleHtml = token.title
            ? '<p class="container-title">' + token.title + '</p>\n'
            : '';
          return '<div class="container container-' + token.containerType + '">\n'
            + titleHtml
            + content
            + '</div>\n';
        }
      }
    ]
  };
})();
