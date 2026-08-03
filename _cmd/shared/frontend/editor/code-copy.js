/**
 * プレビュー内のコードブロック（``` で囲んだ部分）にコピーボタンを付与する。
 *
 * プレビューは srcdoc の iframe で描画されるため navigator.clipboard が使えるとは限らない。
 * 実際のコピー処理は呼び出し元から渡す onCopy に委ねる
 * （Lite は Go 側の CopyToClipboard を渡す）。
 */

// iframe に注入する <style> のID
export const CODE_COPY_STYLE_ID = 'binder-code-copy-style';

// <pre> を包むラッパーとボタンのクラス名
const WRAP_CLASS = 'binderCodeBlock';
const BUTTON_CLASS = 'binderCopyButton';
// data-copy-text を持つ要素（Mermaid の図など）に付けるクラス名
const HOST_CLASS = 'binderCopyHost';

// コピー完了表示を元のラベルに戻すまでのミリ秒
const COPIED_DURATION = 1500;

/**
 * コピーボタン用のスタイルを iframe に注入する。
 *
 * iframe にはアプリのテーマCSSが読み込まれないため、親ドキュメントで解決済みの
 * CSS変数の値を実値として取り出す。取れない場合はテーマ非依存の既定色に落とす。
 */
export function applyCodeCopyStyle(doc) {
  const head = doc?.head || doc?.documentElement;
  if (!head) return;

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

  const bg = pick('--bg-elevated', 'rgba(127,127,127,0.18)');
  const bgHover = pick('--bg-overlay', 'rgba(127,127,127,0.32)');
  const border = pick('--border-primary', 'rgba(127,127,127,0.4)');
  const text = pick('--text-muted', 'inherit');

  const css = [
    `.${WRAP_CLASS}, .${HOST_CLASS} { position: relative; }`,
    `.${BUTTON_CLASS} {`,
    '  position: absolute;',
    '  top: 6px;',
    '  right: 6px;',
    '  z-index: 1;',
    '  padding: 2px 8px;',
    '  font-family: inherit;',
    '  font-size: 12px;',
    '  line-height: 1.6;',
    `  color: ${text};`,
    `  background: ${bg};`,
    `  border: 1px solid ${border};`,
    '  border-radius: 4px;',
    '  cursor: pointer;',
    '  opacity: 0;',
    '  transition: opacity 0.15s;',
    '}',
    `.${WRAP_CLASS}:hover .${BUTTON_CLASS}, .${HOST_CLASS}:hover .${BUTTON_CLASS} { opacity: 0.85; }`,
    `.${BUTTON_CLASS}:hover { opacity: 1; background: ${bgHover}; }`,
    `.${BUTTON_CLASS}.copied { opacity: 1; }`,
  ].join('\n');

  const exist = doc.getElementById?.(CODE_COPY_STYLE_ID);
  const style = exist || doc.createElement('style');
  style.id = CODE_COPY_STYLE_ID;
  style.textContent = css;
  if (!exist) head.appendChild(style);
}

/**
 * コピーボタンを1つ生成する。
 *
 * @param {Document} doc
 * @param {() => string} getText コピーする文字列を返す関数（クリック時に評価する）
 * @param {{onCopy: Function, copyLabel: string, copiedLabel: string}} ctx
 */
function createButton(doc, getText, ctx) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = BUTTON_CLASS;
  btn.dataset.copyLabel = ctx.copyLabel;
  btn.dataset.copiedLabel = ctx.copiedLabel;
  btn.textContent = ctx.copyLabel;
  btn.setAttribute('aria-label', ctx.copyLabel);

  let timer = null;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const rtn = ctx.onCopy(getText());
      // Wails のバインディングは Promise を返す。失敗を握り潰さずログに残す
      if (rtn && typeof rtn.then === 'function') {
        rtn.catch((err) => console.error('[Binder] copy failed:', err));
      }
    } catch (err) {
      console.error('[Binder] copy failed:', err);
      return;
    }

    btn.textContent = btn.dataset.copiedLabel;
    btn.classList.add('copied');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      btn.textContent = btn.dataset.copyLabel;
      btn.setAttribute('aria-label', btn.dataset.copyLabel);
      btn.classList.remove('copied');
      timer = null;
    }, COPIED_DURATION);
  });

  return btn;
}

/**
 * コピーボタンを付与する。対象は2種類:
 *
 * - `<pre><code>` — コードブロック本文をコピーする
 * - `data-copy-text` を持つ要素 — その属性値をコピーする。
 *   ```mermaid のように図へ置き換わってコードが画面から消えるものを、
 *   描画側が元ソースを持たせることでコピー対象にできる
 *
 * @param {Document} doc     対象ドキュメント（iframe の contentDocument）
 * @param {Object}   options
 * @param {(text:string) => any} options.onCopy コピー処理。未指定なら何もしない
 * @param {string}   [options.copyLabel]   ボタンのラベル
 * @param {string}   [options.copiedLabel] コピー完了時のラベル
 * @returns {number} ボタンを付けた要素数
 */
export function attachCodeCopy(doc, options = {}) {
  const { onCopy, copyLabel = 'Copy', copiedLabel = 'Copied' } = options;
  if (typeof onCopy !== 'function' || !doc?.body) return 0;

  const codes = doc.querySelectorAll('pre > code');
  const hosts = doc.querySelectorAll('[data-copy-text]');
  if (codes.length === 0 && hosts.length === 0) return 0;

  applyCodeCopyStyle(doc);

  const ctx = { onCopy, copyLabel, copiedLabel };
  let count = 0;

  for (const code of codes) {
    const pre = code.parentElement;
    // 二重付与を防ぐ（再描画時は iframe ごと作り直されるため通常は起きない）
    if (!pre?.parentNode || pre.parentElement?.classList.contains(WRAP_CLASS)) continue;

    // <pre> は overflow-x: auto を持つため、ボタンを中に入れると横スクロールに追従してしまう。
    // 相対配置のラッパーで包み、その中にボタンを重ねる
    const wrap = doc.createElement('div');
    wrap.className = WRAP_CLASS;
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    // marked は末尾に改行を付けるため取り除く
    wrap.appendChild(createButton(doc, () => String(code.textContent).replace(/\n$/, ''), ctx));
    count++;
  }

  for (const host of hosts) {
    if (host.querySelector(`:scope > .${BUTTON_CLASS}`)) continue;
    host.classList.add(HOST_CLASS);
    host.appendChild(createButton(doc, () => String(host.dataset.copyText), ctx));
    count++;
  }

  return count;
}

/**
 * 付与済みボタンのラベルを差し替える（言語切り替え用）。
 * プレビューHTMLが変わらない限り iframe は作り直されないため、
 * 言語を変えただけではボタンのラベルが古いままになる。
 */
export function refreshCodeCopyLabels(doc, copyLabel, copiedLabel) {
  if (!doc?.body) return;
  for (const btn of doc.querySelectorAll(`.${BUTTON_CLASS}`)) {
    if (copyLabel) btn.dataset.copyLabel = copyLabel;
    if (copiedLabel) btn.dataset.copiedLabel = copiedLabel;
    if (!btn.classList.contains('copied')) {
      btn.textContent = btn.dataset.copyLabel;
      btn.setAttribute('aria-label', btn.dataset.copyLabel);
    }
  }
}
