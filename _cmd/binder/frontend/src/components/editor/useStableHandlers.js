import { useRef } from "react";

/**
 * ハンドラの束を、描画をまたいで同じ関数のまま渡せるようにする。
 *
 * エディタ本体は 1 文字打つたびに描き直され、そのたびにハンドラが作り直される。
 * そのまま渡すと memo にした部品（ツールバー・ダイアログ）も毎回描き直されるので、
 * 渡す関数は最初に作ったものを使い回し、呼ばれたときに最新のハンドラへ取り次ぐ。
 *
 * 取り次ぐ先は常に最後の描画のハンドラなので、中で見る state は古くならない。
 * 描画の途中で呼ぶもの（描画に使う値を返す関数）には使わない。イベントで呼ぶものだけに使う。
 *
 * キーは最初の描画のもので固定する（あとから増やしたキーは返らない）。
 *
 * @template {Record<string, Function>} T
 * @param {T} handlers
 * @returns {T} キーが同じで、関数が変わらないもの
 */
export function useStableHandlers(handlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  const stable = useRef(null);
  if (!stable.current) {
    const obj = {};
    for (const key of Object.keys(handlers)) {
      obj[key] = (...args) => latest.current[key](...args);
    }
    stable.current = obj;
  }
  return stable.current;
}
