import { useRef } from "react";

/**
 * 幅を変えるスプリッターのドラッグ。
 *
 * Pointer Capture を使う（iframe をまたいでもイベントが途切れない）。
 * ドラッグ中は state を更新せず、apply で DOM を直接書き換える（巨大な Editor の再レンダーを避ける）。
 * 最後の値は離したときに一度だけ onCommit へ渡す。
 *
 * @param {object} opts
 * @param {boolean} opts.enabled ドラッグを受け付けるか
 * @param {number} opts.size 現在の幅
 * @param {(width: number) => void} opts.onCommit 離したときの幅を受け取る
 * @param {number} opts.min 最小の幅
 * @param {string} opts.containerId ドラッグ中にアニメーションを止める要素の id
 * @param {(width: number) => void} opts.apply ドラッグ中の幅を DOM に書く
 * @returns {{ ref, onPointerDown, onPointerMove, onPointerUp }} スプリッターの要素へ渡す
 */
export function useSplitterDrag({ enabled, size, onCommit, min, containerId, apply }) {
  const ref = useRef(null);
  const startRef = useRef(null);

  const onPointerDown = (e) => {
    if (!enabled) return;
    e.preventDefault();
    startRef.current = { startX: e.clientX, startWidth: size };
    ref.current.setPointerCapture(e.pointerId);
    document.getElementById(containerId)?.classList.add('no-transition');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e) => {
    if (!startRef.current) return;
    const delta = e.clientX - startRef.current.startX;
    const newWidth = Math.max(min, startRef.current.startWidth + delta);
    startRef.current.lastWidth = newWidth;
    apply(newWidth);
  };

  const onPointerUp = () => {
    if (!startRef.current) return;
    const finalWidth = startRef.current.lastWidth;
    startRef.current = null;
    if (finalWidth != null) onCommit(finalWidth);
    document.getElementById(containerId)?.classList.remove('no-transition');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}
