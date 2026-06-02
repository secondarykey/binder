/* @plugin-name: SmartPants (Typography) */
//
// 文章中の記号をタイポグラフィ的に美しい文字に変換する。
//
//   "hello"  → "hello"  （カーリーダブルクォート）
//   'hello'  → 'hello'  （カーリーシングルクォート）
//   it's     → it's     （アポストロフィ）
//   ---      → —        （エムダッシュ）
//   --       → –        （エンダッシュ）
//   ...      → …        （省略記号）
//
(function() {
  function convert(src) {
    return src
      // エムダッシュ（--- の前に処理）
      .replace(/---/g, '—')
      // エンダッシュ
      .replace(/--/g, '–')
      // 省略記号
      .replace(/\.\.\./g, '…')
      // 開きダブルクォート：空白・行頭・開き括弧の後の "
      .replace(/(^|[\s\(\[\{<])"(?=\S)/gm, '$1“')
      // 閉じダブルクォート：残り全て
      .replace(/"/g, '”')
      // 開きシングルクォート：空白・行頭・開き括弧の後の '
      .replace(/(^|[\s\(\[\{<])'(?=\S)/gm, '$1‘')
      // 閉じシングルクォート・アポストロフィ：残り全て
      .replace(/'/g, '’');
  }

  return {
    hooks: {
      preprocess: function(src) {
        // コードブロック・インラインコード・HTMLコメント・水平線を退避してから変換
        // 水平線 (---, ***, ___) は行全体が記号のみの行なので保護する
        var blocks = [];
        var result = src.replace(/<!--[\s\S]*?-->|```[\s\S]*?```|`[^`\n]+`|^[ \t]*(?:-[ \t]*){3,}$|^[ \t]*(?:\*[ \t]*){3,}$|^[ \t]*(?:_[ \t]*){3,}$/gm, function(m) {
          blocks.push(m);
          return '\x00CODE' + (blocks.length - 1) + '\x00';
        });
        result = convert(result);
        // 退避していたコードを復元
        return result.replace(/\x00CODE(\d+)\x00/g, function(_, i) {
          return blocks[parseInt(i, 10)];
        });
      }
    }
  };
})();
