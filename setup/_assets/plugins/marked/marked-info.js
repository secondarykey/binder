/* @plugin-name: Marked Info (@info) */
//
// @info を marked.js の情報表示ブロックに変換する。
// ロード中の拡張機能・renderer オーバーライド・hooks・オプション設定を確認できる。
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
            return { type: 'markedInfo', raw: match[0] };
          }
        },
        renderer: function() {
          var m = globalThis.marked;
          var markedFn = m && m.marked;
          var defaults = (markedFn && markedFn.defaults) || {};
          var ext = defaults.extensions;

          // 拡張機能名（extensions.renderers のキー）
          var extNames = Object.keys((ext && ext.renderers) || {});

          // renderer オーバーライド（own property として追加されたメソッド）
          var rendererOverrides = [];
          var r = defaults.renderer;
          if (r) {
            var skip = { constructor: true, options: true, parser: true };
            rendererOverrides = Object.getOwnPropertyNames(r).filter(function(k) {
              return !skip[k] && typeof r[k] === 'function';
            });
          }

          // hooks（preprocess / postprocess）
          var activeHooks = [];
          var h = defaults.hooks;
          if (h) {
            if (typeof h.preprocess === 'function')  activeHooks.push('preprocess');
            if (typeof h.postprocess === 'function') activeHooks.push('postprocess');
          }

          // walkTokens
          var hasWalkTokens = typeof defaults.walkTokens === 'function';

          // --- 描画 ---
          var s = 'border:1px solid var(--border-primary,#444);border-radius:4px;'
                + 'padding:12px 16px;font-size:13px;'
                + 'color:var(--text-primary,#eee);background:var(--bg-overlay,#1a1a1a);';
          var td1 = 'padding:2px 10px 2px 0;color:var(--text-muted,#888);'
                  + 'white-space:nowrap;vertical-align:top';
          var td2 = 'padding:2px 0;vertical-align:top';

          function chips(names) {
            if (!names.length) {
              return '<span style="color:var(--text-muted,#888)">none</span>';
            }
            return names.map(function(n) {
              return '<code style="background:var(--bg-elevated,#2a2a2a);padding:1px 5px;'
                   + 'border-radius:3px;margin:0 2px 2px 0;display:inline-block">' + n + '</code>';
            }).join(' ');
          }

          function yesno(val) {
            return val ? '✅ on' : '❌ off';
          }

          var rows = [
            ['GFM',                yesno(defaults.gfm !== false)],
            ['Breaks',             yesno(defaults.breaks)],
            ['Async',              yesno(defaults.async)],
            ['Pedantic',           yesno(defaults.pedantic)],
            ['Extensions',         chips(extNames)],
            ['Renderer overrides', chips(rendererOverrides)],
            ['Hooks',              chips(activeHooks)],
            ['walkTokens',         yesno(hasWalkTokens)],
          ];

          var trs = rows.map(function(row) {
            return '<tr>'
                 + '<td style="' + td1 + '">' + row[0] + '</td>'
                 + '<td style="' + td2 + '">' + row[1] + '</td>'
                 + '</tr>';
          }).join('');

          return '<div style="' + s + '">'
               + '<div style="font-weight:bold;margin-bottom:8px">📦 marked.js</div>'
               + '<table style="border-collapse:collapse;width:100%">' + trs + '</table>'
               + '</div>\n';
        }
      }
    ]
  };
})();
