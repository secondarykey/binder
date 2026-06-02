/* @plugin-name: Table of Contents ([TOC]) */
//
// [TOC] を見出しの目次（Table of Contents）に変換する。
// 見出し（# h1 〜 ###### h6）に自動でアンカーIDを付与する。
//
// 使い方:
//   [TOC]
//
//   # はじめに
//   ## インストール
//   ## 使い方
//   ### 基本操作
//
(function() {
  var headings = [];
  var TOC_COMMENT = '<!-- toc-placeholder -->';

  function slugify(text) {
    return text
      .replace(/<[^>]*>/g, '')          // HTMLタグ除去
      .replace(/[*_`~\[\]()]/g, '')     // markdownの記号除去
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w぀-ヿ一-鿿\-]/g, '')
      .replace(/\-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildTOC(headings) {
    if (!headings.length) return '';

    var minLevel = headings.reduce(function(m, h) {
      return Math.min(m, h.level);
    }, 6);

    var html = '<nav class="toc">\n<ul>\n';
    var prevLevel = minLevel;
    var first = true;

    headings.forEach(function(h) {
      var level = h.level;

      if (first) {
        first = false;
      } else if (level > prevLevel) {
        for (var i = prevLevel; i < level; i++) {
          html += '<ul>\n';
        }
      } else if (level < prevLevel) {
        for (var i = level; i < prevLevel; i++) {
          html += '</li>\n</ul>\n';
        }
        html += '</li>\n';
      } else {
        html += '</li>\n';
      }

      html += '<li><a href="#' + h.id + '">' + h.text + '</a>';
      prevLevel = level;
    });

    for (var i = minLevel; i < prevLevel; i++) {
      html += '</li>\n</ul>\n';
    }
    html += '</li>\n</ul>\n</nav>\n';

    return html;
  }

  return {
    hooks: {
      preprocess: function(src) {
        headings = [];
        // [TOC] が単独行にある場合にプレースホルダへ置換
        return src.replace(/^\[TOC\]\s*$/gm, TOC_COMMENT);
      },
      postprocess: function(html) {
        if (html.indexOf(TOC_COMMENT) === -1) return html;
        var toc = buildTOC(headings);
        return html.split(TOC_COMMENT).join(toc);
      }
    },
    renderer: {
      heading: function(token) {
        var text = this.parser.parseInline(token.tokens);
        var id = slugify(token.text);
        headings.push({ level: token.depth, text: text, id: id });
        return '<h' + token.depth + ' id="' + id + '">'
          + text
          + '</h' + token.depth + '>\n';
      }
    }
  };
})();
