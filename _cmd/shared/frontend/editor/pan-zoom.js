/**
 * プレビュー内の SVG（Mermaid の図）に拡大・移動操作を付与する。
 *
 * - ホイール: 拡大縮小。カーソル位置を基準に寄る
 * - ドラッグ（左・中ボタン）: 移動
 * - ダブルクリック: 元の倍率・位置に戻す
 */

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const STEP = 1.1;

/**
 * @param {Element} container SVG を包む要素
 * @param {Object}  [options]
 * @param {boolean} [options.wheelModifier] true でホイール拡大に Ctrl/⌘ を要求する。
 *        文章中の図では、図の上でも普通にページスクロールできる必要があるため使う
 * @param {string}  [options.hint] container の title 属性に入れる操作説明
 * @returns {boolean} 付与したら true
 */
export function attachPanZoom(container, options = {}) {
  const { wheelModifier = false, hint } = options;

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

    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, e.deltaY > 0 ? scale / STEP : scale * STEP));
    if (next === scale) return;

    // カーソル下の点を固定したまま倍率だけ変える。
    // 変形後の矩形は rect = 基準位置 + オフセット + 倍率*ローカル座標 なので、
    // ローカル座標 (P - rect)/scale が動かないようオフセットを補正する
    const rect = svg.getBoundingClientRect();
    left += (e.clientX - rect.left) * (1 - next / scale);
    top += (e.clientY - rect.top) * (1 - next / scale);
    scale = next;
    apply();
  }, { passive: false });

  container.addEventListener('dblclick', (e) => {
    if (isControl(e)) return;
    e.preventDefault();
    left = 0;
    top = 0;
    scale = 1;
    apply();
  });

  return true;
}
