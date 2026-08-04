/**
 * プレビュー内の SVG（Mermaid の図）に拡大・移動操作を付与する。
 *
 * - ホイール: 拡大縮小。カーソル位置を基準に寄る
 * - ドラッグ（左・中ボタン）: 移動
 * - ダブルクリック: 元の倍率・位置に戻す
 * - 左上の操作ボタン（controls 指定時）: 縮小・元に戻す・拡大
 */

// iframe に注入する <style> のID
export const PAN_ZOOM_STYLE_ID = 'binder-pan-zoom-style';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const STEP = 1.1;
// ボタン操作は1クリックの手応えが要るのでホイールより大きく動かす
const BUTTON_STEP = 1.25;

const CONTROLS_CLASS = 'binderPanZoom';
const CONTROL_BUTTON_CLASS = 'binderPanZoomBtn';

/**
 * 操作ボタンのスタイルを注入する。
 * iframe にはテーマCSSが読み込まれないため、親ドキュメントで解決済みの
 * CSS変数の値を実値として取り出す（取れない場合はテーマ非依存の既定色）。
 */
export function applyPanZoomStyle(doc) {
  const head = doc?.head || doc?.documentElement;
  if (!head) return;

  let cs = null;
  try {
    cs = window.getComputedStyle(window.document.documentElement);
  } catch {
    // noop
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
    `.${CONTROLS_CLASS} {`,
    '  position: absolute;',
    '  top: 6px;',
    '  left: 6px;',
    '  z-index: 2;',
    '  display: grid;',
    '  grid-template-columns: repeat(3, 22px);',
    '  grid-auto-rows: 22px;',
    '  gap: 2px;',
    '  width: max-content;',
    '  opacity: 0;',
    '  transition: opacity 0.15s;',
    '}',
    `.${CONTROLS_CLASS}:hover, [data-pan-zoom="1"]:hover .${CONTROLS_CLASS} { opacity: 0.85; }`,
    `.${CONTROL_BUTTON_CLASS} {`,
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 0;',
    '  font-family: inherit;',
    '  font-size: 11px;',
    '  line-height: 1;',
    `  color: ${text};`,
    `  background: ${bg};`,
    `  border: 1px solid ${border};`,
    '  border-radius: 4px;',
    '  cursor: pointer;',
    '}',
    `.${CONTROL_BUTTON_CLASS}:hover { background: ${bgHover}; }`,
  ].join('\n');

  const exist = doc.getElementById?.(PAN_ZOOM_STYLE_ID);
  const style = exist || doc.createElement('style');
  style.id = PAN_ZOOM_STYLE_ID;
  style.textContent = css;
  if (!exist) head.appendChild(style);
}

/**
 * @param {Element} container SVG を包む要素
 * @param {Object}  [options]
 * @param {boolean} [options.wheelModifier] true でホイール拡大に Ctrl/⌘ を要求する。
 *        文章中の図では、図の上でも普通にページスクロールできる必要があるため使う
 * @param {string}  [options.hint] container の title 属性に入れる操作説明
 * @param {boolean} [options.controls] true で左上に操作ボタンを置く
 * @param {Object}  [options.labels] ボタンの説明 { zoomIn, zoomOut, reset }
 * @returns {boolean} 付与したら true
 */
export function attachPanZoom(container, options = {}) {
  const { wheelModifier = false, hint, controls = false, labels = {} } = options;

  const svg = container?.querySelector?.('svg');
  // 二重付与を防ぐ（再描画時は iframe ごと作り直されるため通常は起きない）
  if (!svg || container.dataset.panZoom === '1') return false;
  container.dataset.panZoom = '1';

  let left = 0;
  let top = 0;
  let scale = 1;

  const apply = () => {
    svg.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  };

  /**
   * 指定した点（クライアント座標）を固定したまま倍率を変える。
   * 変形後の矩形は rect = 基準位置 + オフセット + 倍率*ローカル座標 なので、
   * ローカル座標 (P - rect)/scale が動かないようオフセットを補正する。
   */
  const zoomAt = (next, clientX, clientY) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    if (clamped === scale) return;
    const rect = svg.getBoundingClientRect();
    left += (clientX - rect.left) * (1 - clamped / scale);
    top += (clientY - rect.top) * (1 - clamped / scale);
    scale = clamped;
    apply();
  };

  // ボタン操作は表示領域の中心を基準に拡大する
  const zoomCenter = (next) => {
    const rect = container.getBoundingClientRect();
    zoomAt(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const reset = () => {
    left = 0;
    top = 0;
    scale = 1;
    apply();
  };

  // 変形の基準を左上に固定する。カーソル位置基準の拡大は
  // 「拡大後もカーソル下の点が動かない」ようにオフセットを補正して実現する
  svg.style.transformOrigin = '0 0';
  svg.style.overflow = 'visible';
  container.style.overflow = 'hidden';
  // 文章中の図（wheelModifier）はタッチでのページスクロールを優先する
  if (!wheelModifier) container.style.touchAction = 'none';
  if (hint) container.setAttribute('title', hint);

  // ボタン（コピーボタン等）の操作はドラッグとして扱わない
  const isControl = (e) => !!e.target?.closest?.('button');

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (isControl(e)) return;
    e.preventDefault();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    container.setPointerCapture?.(e.pointerId);
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    left += e.clientX - lastX;
    top += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    apply();
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    container.releasePointerCapture?.(e.pointerId);
    container.style.cursor = '';
  };
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);

  container.addEventListener('wheel', (e) => {
    if (wheelModifier && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomAt(e.deltaY > 0 ? scale / STEP : scale * STEP, e.clientX, e.clientY);
  }, { passive: false });

  container.addEventListener('dblclick', (e) => {
    if (isControl(e)) return;
    e.preventDefault();
    reset();
  });

  if (controls) {
    attachControls(container, labels, {
      zoomIn: () => zoomCenter(scale * BUTTON_STEP),
      zoomOut: () => zoomCenter(scale / BUTTON_STEP),
      reset,
    });
  }

  return true;
}

/**
 * 左上に操作ボタンを置く。上下左右の移動はドラッグで行えるので、
 * 「− / 元に戻す / ＋」の1列だけにする。
 */
function attachControls(container, labels, actions) {
  const doc = container.ownerDocument;
  applyPanZoomStyle(doc);

  // ボタンを絶対配置するため、基準になる position を確保する
  const pos = doc.defaultView?.getComputedStyle?.(container)?.position;
  if (!pos || pos === 'static') container.style.position = 'relative';

  const box = doc.createElement('div');
  box.className = CONTROLS_CLASS;

  // [表示文字, title, 動作]
  const defs = [
    ['−', labels.zoomOut || 'Zoom out', actions.zoomOut],
    ['↺', labels.reset || 'Reset', actions.reset],
    ['＋', labels.zoomIn || 'Zoom in', actions.zoomIn],
  ];

  for (const [text, title, action] of defs) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = CONTROL_BUTTON_CLASS;
    btn.textContent = text;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    });
    box.appendChild(btn);
  }

  container.appendChild(box);
}
