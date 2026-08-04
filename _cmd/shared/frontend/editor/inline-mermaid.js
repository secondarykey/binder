import Mermaid from './engines/Mermaid';
import { attachPanZoom } from './pan-zoom';

/**
 * Markdown プレビュー内の ```mermaid コードブロックを図として描画する。
 *
 * Binder のノートは Go 側が `div.binderSVG` を出力するためこの経路を通らない。
 * Lite のように marked の出力をそのまま表示するアプリ向けの後処理。
 */

// iframe に注入する <style> のID
export const INLINE_MERMAID_STYLE_ID = 'binder-inline-mermaid-style';

// 描画した図を包む要素のクラス名。
// 全画面表示用の .binderSVG（height: 100vh 指定）とは別にして、
// 文章中の図が1画面分の高さを占めないようにする
const CLASS = 'binderMermaid';

/**
 * mermaid のコードブロックかどうかを判定する。
 * marked は言語名を language-xxx クラスとして出力する。
 */
function isMermaidCode(code) {
  return code.classList.contains('language-mermaid') || code.classList.contains('mermaid');
}

/**
 * 図の配置スタイルを注入する。
 * プレビューCSSはユーザーが編集したファイルが優先されるため、そちらに書くと
 * 既存ユーザーには反映されない。JS 側から注入して常に効くようにする。
 */
export function applyInlineMermaidStyle(doc) {
  const head = doc?.head || doc?.documentElement;
  if (!head) return;

  const css = [
    `.${CLASS} { margin: 1em 0; display: flex; justify-content: center; }`,
    `.${CLASS} svg { max-width: 100%; height: auto; }`,
  ].join('\n');

  const exist = doc.getElementById?.(INLINE_MERMAID_STYLE_ID);
  const style = exist || doc.createElement('style');
  style.id = INLINE_MERMAID_STYLE_ID;
  style.textContent = css;
  if (!exist) head.appendChild(style);
}

/**
 * ```mermaid のコードブロックを SVG に置き換える。
 *
 * 構文エラー（編集途中を含む）の場合はコードブロックのまま残す。
 * 図が消えるより、書きかけのテキストが見えている方が状態が分かりやすい。
 *
 * @param {Document} doc 対象ドキュメント（iframe の contentDocument）
 * @param {Object}   [options]
 * @param {string}   [options.panZoomHint] 図に付ける操作説明（title 属性）
 * @param {Object}   [options.panZoomLabels] 指定すると図に操作ボタンを置く
 * @returns {Promise<number>} 図に置き換えたブロック数
 */
export async function renderInlineMermaid(doc, options = {}) {
  if (!doc?.body) return 0;

  const codes = Array.from(doc.querySelectorAll('pre > code')).filter(isMermaidCode);
  if (codes.length === 0) return 0;

  applyInlineMermaidStyle(doc);

  let count = 0;
  // mermaid.render は描画用の一時要素をIDで扱うため、並列化せず1つずつ処理する
  for (const code of codes) {
    const pre = code.parentElement;
    if (!pre?.parentNode) continue;

    const src = String(code.textContent);
    try {
      const data = await Mermaid.parse(src);
      const div = doc.createElement('div');
      div.className = CLASS;
      // プレビューのスクロール同期に使う行番号を引き継ぐ
      const line = pre.getAttribute('data-src-line');
      if (line) div.setAttribute('data-src-line', line);
      // 図に置き換わるとコードが画面から消えるため、コピー用に元ソースを持たせる
      // （code-copy.js が data-copy-text を拾ってボタンを付ける）
      div.dataset.copyText = src.replace(/\n$/, '');
      div.innerHTML = data.svg;
      pre.parentNode.replaceChild(div, pre);
      // 文章中の図なので、ホイールは Ctrl 併用時だけ拡大に使う
      // （そのままだと図の上でページをスクロールできなくなる）
      attachPanZoom(div, {
        wheelModifier: true,
        hint: options.panZoomHint,
        controls: !!options.panZoomLabels,
        labels: options.panZoomLabels,
      });
      count++;
    } catch (err) {
      console.warn('[Binder] mermaid render failed:', err);
    }
  }

  return count;
}
