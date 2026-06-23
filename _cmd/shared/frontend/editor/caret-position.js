/**
 * textarea のカーソル位置からビューポート座標を取得する
 *
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ top: number, left: number, height: number } | null}
 */
export function getCaretPosition(textarea) {
  if (!textarea) return null;
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  for (const prop of style) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.width = textarea.clientWidth + 'px';
  mirror.style.height = 'auto';

  const text = textarea.value.substring(0, textarea.selectionStart);
  mirror.textContent = text;
  const span = document.createElement('span');
  span.textContent = '.';
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const rect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  const top = rect.top + (spanRect.top - mirrorRect.top) - textarea.scrollTop;
  const left = rect.left + (spanRect.left - mirrorRect.left) - textarea.scrollLeft;
  const height = spanRect.height;
  document.body.removeChild(mirror);
  return { top: Math.min(Math.max(top, rect.top), rect.bottom), left: Math.min(Math.max(left, rect.left), rect.right), height };
}
