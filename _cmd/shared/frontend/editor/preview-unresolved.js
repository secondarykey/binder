/**
 * プレビューで解決できない参照を、見えるプレースホルダに置き換える。
 *
 * プレビューは srcdoc の iframe で描画されるため、公開時の相対パス
 * （../images/x.svg 等）を読み込めない。放っておくと壊れた画像アイコンが出るだけで、
 * 「まだ公開していない」のか「パスを間違えた」のか「プレビューでは出せない」のかが
 * 区別できない。黙って別のもの（前回公開時の古い成果物など）を見せるより、
 * 解決できないと明示する。
 *
 * プレビューで読み込める src は data: / blob: と絶対URLだけ。
 * それ以外（相対パス・ルート相対パス）は必ず解決できないため、
 * 読み込みの失敗を待たずに置き換えられる。
 */

// iframe に注入する <style> のID
export const UNRESOLVED_STYLE_ID = 'binder-unresolved-style';

// プレースホルダに付けるクラス名
const PLACEHOLDER_CLASS = 'binderUnresolved';

// プレビュー内で読み込める参照
const RESOLVABLE = /^(data:|blob:|https?:|\/\/)/i;

/**
 * プレビューで解決できない参照かどうか。
 */
export function isUnresolvedSrc(src) {
  const v = (src || '').trim();
  // src が空のものは別の壊れ方なので対象にしない
  if (!v) return false;
  return !RESOLVABLE.test(v);
}

/**
 * 解決できない <img> をプレースホルダに置き換える。
 *
 * @param {Document} doc
 * @param {string} label 表示する説明（例: 「公開後に表示されます」）
 * @returns {number} 置き換えた数
 */
export function markUnresolvedResources(doc, label) {
  if (!doc?.querySelectorAll) return 0;

  const targets = Array.from(doc.querySelectorAll('img[src]'))
    .filter((img) => isUnresolvedSrc(img.getAttribute('src')));
  if (targets.length === 0) return 0;

  applyUnresolvedStyle(doc);

  for (const img of targets) {
    const src = img.getAttribute('src');
    const box = doc.createElement('span');
    box.className = PLACEHOLDER_CLASS;
    box.setAttribute('title', src);

    const text = doc.createElement('span');
    text.textContent = label || src;
    box.appendChild(text);

    if (label) {
      const path = doc.createElement('code');
      path.textContent = src;
      box.appendChild(path);
    }

    img.replaceWith(box);
  }

  return targets.length;
}

/**
 * プレースホルダ用のスタイルを iframe に注入する。
 *
 * iframe にはアプリのテーマCSSが読み込まれないため、親ドキュメントで解決済みの
 * CSS変数の値を実値として取り出す。取れない場合はテーマ非依存の既定色に落とす。
 */
function applyUnresolvedStyle(doc) {
  const head = doc?.head || doc?.documentElement;
  if (!head || doc.getElementById?.(UNRESOLVED_STYLE_ID)) return;

  let cs = null;
  try {
    cs = window.getComputedStyle(window.document.documentElement);
  } catch {
    // noop（テーマ変数が取れなければ既定色を使う）
  }
  const pick = (name, fallback) => {
    const v = cs?.getPropertyValue(name)?.trim();
    return v || fallback;
  };

  const border = pick('--border-primary', 'rgba(127,127,127,0.5)');
  const text = pick('--text-muted', 'inherit');
  const bg = pick('--bg-elevated', 'rgba(127,127,127,0.12)');

  const style = doc.createElement('style');
  style.id = UNRESOLVED_STYLE_ID;
  style.textContent = [
    `.${PLACEHOLDER_CLASS} {`,
    '  display: inline-flex; align-items: baseline; gap: 6px;',
    '  padding: 6px 10px; border-radius: 4px; font-size: 0.9em;',
    `  border: 1px dashed ${border}; color: ${text}; background: ${bg};`,
    '}',
    `.${PLACEHOLDER_CLASS} code { font-size: 0.9em; opacity: 0.75; word-break: break-all; }`,
  ].join('\n');
  head.appendChild(style);
}
