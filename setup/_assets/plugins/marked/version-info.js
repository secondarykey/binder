/* @plugin-name: Marked Info (@info) */
//
// @info を marked.js の情報表示ブロックに変換する。
// 現在ロード中の拡張機能やオプション設定を確認できる。
//
// 使い方:
//   @info
//
(function() {
  return {
    extensions: [
      {
        name: 'markedInfo',
        level: 'block',
        start: function(src) {
          var m = src.match(/^@info\s*$/m);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^@info[ \t]*(?:\n|$)/);
          if (match) {
            return {
              type: 'markedInfo',
              raw: match[0],
            };
          }
        },
        renderer: function() {
          var m = globalThis.marked;
          var markedFn = m && m.marked;
          var defaults = (markedFn && markedFn.defaults) || {};
          var ext = defaults.extensions;

          // marked v14 は extensions.renderers のキーに拡張機能名が入る
          var extNames = Object.keys((ext && ext.renderers) || {});

          var html = '<div class="marked-info" style="'
            + 'border:1px solid var(--border-primary,#444);'
            + 'border-radius:4px;padding:12px 16px;'
            + 'font-size:13px;color:var(--text-primary,#eee);'
            + 'background:var(--bg-overlay,#1a1a1a);'
            + '">';

          html += '<div style="font-weight:bold;margin-bottom:8px">📦 marked.js</div>';
          html += '<table style="border-collapse:collapse;width:100%">';

          html += '<tr><td style="padding:2px 8px 2px 0;color:var(--text-muted,#888);white-space:nowrap">GFM</td>'
            + '<td>' + (defaults.gfm !== false ? '✅ on' : '❌ off') + '</td></tr>';
          html += '<tr><td style="padding:2px 8px 2px 0;color:var(--text-muted,#888);white-space:nowrap">Breaks</td>'
            + '<td>' + (defaults.breaks ? '✅ on' : '❌ off') + '</td></tr>';
          html += '<tr><td style="padding:2px 8px 2px 0;color:var(--text-muted,#888);white-space:nowrap">Async</td>'
            + '<td>' + (defaults.async ? '✅ on' : '❌ off') + '</td></tr>';
          html += '<tr><td style="padding:2px 8px 2px 0;color:var(--text-muted,#888);white-space:nowrap">Pedantic</td>'
            + '<td>' + (defaults.pedantic ? '✅ on' : '❌ off') + '</td></tr>';

          html += '<tr><td style="padding:6px 8px 2px 0;color:var(--text-muted,#888);white-space:nowrap;vertical-align:top">Extensions</td>'
            + '<td style="padding-top:6px">'
            + (extNames.length > 0
              ? extNames.map(function(n) {
                  return '<code style="background:var(--bg-elevated,#2a2a2a);padding:1px 5px;border-radius:3px;margin:0 2px 2px 0;display:inline-block">' + n + '</code>';
                }).join(' ')
              : '<span style="color:var(--text-muted,#888)">none</span>')
            + '</td></tr>';

          html += '</table>';
          html += '</div>\n';
          return html;
        }
      }
    ]
  };
})();
