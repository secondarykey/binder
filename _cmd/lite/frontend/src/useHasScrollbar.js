import { useState, useEffect, useCallback } from 'react';

const SCROLLBAR_WIDTH = 17; // Windows標準のスクロールバー幅

/**
 * 指定セレクタの要素に縦スクロールバーが表示されているかを検出するフック。
 * ボタンの right 位置を返す（スクロールバーがあれば SCROLLBAR_WIDTH 分ずらす）。
 *
 * @param {string} selector - 監視対象の CSS セレクタ
 * @param {number} baseRight - スクロールバーなし時の right (px)
 * @param {*} deps - 再チェックのトリガー（テキスト変更など）
 * @returns {number} ボタンの right 位置 (px)
 */
export function useScrollbarOffset(selector, baseRight, deps) {
  const [right, setRight] = useState(baseRight);

  const check = useCallback(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    const has = el.scrollHeight > el.clientHeight;
    setRight(has ? baseRight + SCROLLBAR_WIDTH : baseRight);
  }, [selector, baseRight]);

  useEffect(() => {
    check();
    // ResizeObserver で要素サイズ変更時にも再チェック
    const el = document.querySelector(selector);
    if (!el) return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [selector, check, deps]);

  return right;
}

/**
 * 指定セレクタの要素に横スクロールバーが表示されているかを検出するフック。
 * ボタンの bottom 位置を返す（スクロールバーがあれば SCROLLBAR_WIDTH 分ずらす）。
 *
 * @param {string} selector - 監視対象の CSS セレクタ
 * @param {number} baseBottom - スクロールバーなし時の bottom (px)
 * @param {*} deps - 再チェックのトリガー
 * @returns {number} ボタンの bottom 位置 (px)
 */
export function useHScrollbarOffset(selector, baseBottom, deps) {
  const [bottom, setBottom] = useState(baseBottom);

  const check = useCallback(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    const has = el.scrollWidth > el.clientWidth;
    setBottom(has ? baseBottom + SCROLLBAR_WIDTH : baseBottom);
  }, [selector, baseBottom]);

  useEffect(() => {
    check();
    const el = document.querySelector(selector);
    if (!el) return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [selector, check, deps]);

  return bottom;
}

/**
 * iframe 内のコンテンツに縦スクロールバーが表示されているかを検出するフック。
 *
 * @param {string} selector - iframe の CSS セレクタ
 * @param {number} baseRight - スクロールバーなし時の right (px)
 * @param {*} deps - 再チェックのトリガー（HTML変更など）
 * @returns {number} ボタンの right 位置 (px)
 */
export function useIframeScrollbarOffset(selector, baseRight, deps) {
  const [right, setRight] = useState(baseRight);

  useEffect(() => {
    const check = () => {
      // 表示中の iframe（visibility: visible）をチェック
      const iframes = document.querySelectorAll(selector);
      for (const iframe of iframes) {
        if (iframe.style.visibility === 'hidden') continue;
        try {
          const doc = iframe.contentDocument;
          if (doc && doc.body) {
            const has = doc.body.scrollHeight > iframe.clientHeight;
            setRight(has ? baseRight + SCROLLBAR_WIDTH : baseRight);
            return;
          }
        } catch { /* cross-origin */ }
      }
      setRight(baseRight);
    };

    // HTML変更後に少し待ってからチェック（iframe描画完了を待つ）
    const timer = setTimeout(check, 500);
    return () => clearTimeout(timer);
  }, [selector, baseRight, deps]);

  return right;
}
