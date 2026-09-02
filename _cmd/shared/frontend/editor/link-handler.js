/**
 * プレビュー内のリンク操作を制御する。
 *
 * プレビューはビューアであってブラウザではないため、iframe 自身を遷移させない。
 * リンクは種別ごとに意味を割り当て、呼び出し元のコールバックへ委譲する。
 *
 *   - ページ内アンカー（#heading / #fn-1） … プレビュー内をスクロールする
 *   - 外部リンク（http/https 等）          … onExternal に渡す（OSのブラウザで開く想定）
 *   - バインダー内リンク（/pages/x.html 等）… onInternal に渡す（アプリ側でそのエントリを開く想定）
 *
 * srcdoc の iframe は base URL を親ドキュメントから継承するため、
 * 相対リンクもページ内アンカーもアプリ自身のURLへ解決されてしまう。
 * ブラウザ既定の遷移に任せられないので、全て自前で処理する。
 *
 * さらに href を data-href へ退避しておく。href を持たない <a> には
 * WebView のコンテキストメニューが「リンクを開く」を出さなくなるため、
 * 右クリック経由で iframe が遷移してしまう抜け道を塞げる。
 */

// javascript: 等、プレビューから辿らせないスキーム
const BLOCKED_SCHEME = /^(javascript|data|vbscript|blob):/i;
// スキーム付きURL（mailto: や file: も含めて外部扱いとし、OS側に委ねる）
const ABSOLUTE_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * href をリンク種別に分類する。
 * @returns {'anchor'|'external'|'internal'|'blocked'}
 */
export function classifyLink(href) {
  const v = (href || '').trim();
  if (!v) return 'blocked';
  if (v.startsWith('#')) return 'anchor';
  if (BLOCKED_SCHEME.test(v)) return 'blocked';
  // //example.com はスキーム相対URL。外部として扱う
  if (v.startsWith('//')) return 'external';
  if (ABSOLUTE_SCHEME.test(v)) return 'external';
  return 'internal';
}

/**
 * ドキュメント内の <a href> を data-href へ書き換え、種別を data-link-kind に記録する。
 *
 * Mermaid の描画で <a> が後から増えるため、描画完了後に呼ぶこと。
 * 書き換え済みのリンクは再処理しない。
 */
export function applyLinkPolicy(doc) {
  if (!doc?.querySelectorAll) return;

  const view = doc.defaultView;
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    const kind = classifyLink(href);

    keepLinkStyle(view, a);

    a.dataset.linkKind = kind;
    if (kind === 'blocked') {
      delete a.dataset.href;
    } else {
      a.dataset.href = href;
    }
    // 外部リンクは href を外すと行き先が分からなくなるため title で補う
    if (kind === 'external' && !a.getAttribute('title')) a.setAttribute('title', href);

    a.removeAttribute('href');
    a.removeAttribute('target');
  }
}

/**
 * クリックの委譲リスナを登録する。iframe ごとに1回だけ呼ぶ。
 *
 * @param {Document} doc
 * @param {object} opts
 * @param {(url: string) => void} [opts.onExternal] 外部リンクを開く処理
 * @param {(href: string) => void} [opts.onInternal] バインダー内リンクを開く処理
 */
export function attachLinkHandler(doc, opts = {}) {
  if (!doc?.addEventListener) return;

  doc.addEventListener('click', (e) => {
    // プレビューは閲覧専用。既定の遷移・送信は常に止める
    e.preventDefault();

    const a = e.target?.closest?.('a[data-link-kind]');
    if (!a) return;

    const href = a.dataset.href;
    switch (a.dataset.linkKind) {
      case 'anchor':
        scrollToAnchor(doc, href);
        break;
      case 'external':
        if (href) opts.onExternal?.(href);
        break;
      case 'internal':
        if (href) opts.onInternal?.(href);
        break;
      default:
        break;
    }
  });
}

/**
 * href を外すと :link 由来の色・下線が失われるため、実値を保持しておく。
 */
function keepLinkStyle(view, a) {
  if (view?.getComputedStyle) {
    try {
      const cs = view.getComputedStyle(a);
      if (cs.color) a.style.color = cs.color;
      if (cs.textDecorationLine) a.style.textDecorationLine = cs.textDecorationLine;
    } catch {
      // noop（計算値が取れない場合はテーマの既定表示に任せる）
    }
  }
  a.style.cursor = 'pointer';
}

/**
 * ページ内アンカーの飛び先までスクロールする。
 * id が見つからない場合は name 属性（脚注の戻りリンク等）も見る。
 */
function scrollToAnchor(doc, href) {
  if (!href || href === '#') return;

  const raw = href.slice(1);
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // noop（不正なエスケープはそのままIDとして扱う）
  }

  const target = doc.getElementById(id)
    || doc.getElementById(raw)
    || doc.getElementsByName?.(id)?.[0]
    || doc.getElementsByName?.(raw)?.[0];

  if (typeof target?.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}
