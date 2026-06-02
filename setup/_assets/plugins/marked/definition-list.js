/* @plugin-name: Definition List */
//
// 定義リスト記法を追加する。
// 用語の直後の行に `: 定義` と書くと <dl><dt><dd> に変換される。
//
// 使い方:
//   Go
//   : Googleが開発したオープンソースのプログラミング言語。
//
//   Rust
//   : メモリ安全性に重点を置いた言語。
//   : Mozilla Research が開発した。
//
(function() {
  return {
    extensions: [
      {
        name: 'definitionList',
        level: 'block',
        start: function(src) {
          var m = src.match(/^[^\n:][^\n]*\n:\s/m);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          // 用語行 + 1行以上の定義行（: で始まる）にマッチ
          var match = src.match(/^([^\n:][^\n]*)\n((?::\s+[^\n]+\n?)+)/);
          if (!match) return;

          var term = match[1].trim();
          var defLines = match[2].trim().split('\n');
          var defs = defLines.map(function(line) {
            return line.replace(/^:\s+/, '').trim();
          }).filter(Boolean);

          if (!defs.length) return;

          return {
            type: 'definitionList',
            raw: match[0],
            term: term,
            defs: defs,
          };
        },
        renderer: function(token) {
          var dds = token.defs.map(function(d) {
            return '  <dd>' + d + '</dd>';
          }).join('\n');
          return '<dl>\n  <dt>' + token.term + '</dt>\n' + dds + '\n</dl>\n';
        }
      }
    ]
  };
})();
