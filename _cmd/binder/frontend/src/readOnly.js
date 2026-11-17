import { createContext, useContext, useEffect, useState } from 'react';
import { IsReadOnly } from '../bindings/binder/api/app';

/**
 * 読み取り専用で開いているか（別の Binder が開いているバインダーを見るだけで開いたとき）。
 * 設計は _docs/readonly-open.md。
 *
 * メインウィンドウは App.jsx が値を持ち、ReadOnlyContext で配る。
 * 配下の部品は useReadOnly() を見て、書き込みの操作（保存・作成・削除・記録・公開など）を出さない。
 * 出し忘れても Go 側が断る（読み取り専用で開いています）ので、バインダーは壊れない。
 *
 * 既定値の null は「App の配下ではない」（別ウィンドウ）を表す。
 */
export const ReadOnlyContext = createContext(null);

/** メインウィンドウの部品用。App の配下でなければ false。 */
export function useReadOnly() {
  return !!useContext(ReadOnlyContext);
}

/**
 * メインウィンドウと別ウィンドウ（履歴・プレビュー・検索）の両方で使う部品用。
 * App の配下なら ReadOnlyContext を、そうでなければ開いたときに Go（IsReadOnly）に聞いた値を返す。
 * binderPath 指定（バインダーを開かずに見る）のときは、開いているバインダーとは別なので false。
 */
export function useBinderReadOnly(binderPath = '') {
  const ctx = useContext(ReadOnlyContext);
  const [fromGo, setFromGo] = useState(false);
  const askGo = ctx === null && !binderPath;
  useEffect(() => {
    if (!askGo) return;
    let alive = true;
    IsReadOnly().then((v) => { if (alive) setFromGo(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, [askGo]);
  if (binderPath) return false;
  return ctx !== null ? ctx : fromGo;
}

/** 「別の Binder で開かれている」の MessageError.code（api/message.go の CodeOpenedElsewhere）。 */
export const CodeOpenedElsewhere = 'openedElsewhere';
