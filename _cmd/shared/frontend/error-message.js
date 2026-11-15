/**
 * Go/Wails から返ったエラー（またはフロントのエラー）を、画面に出せる文字列にする。
 *
 * Wails v3 はバインドメソッドの error を
 *   {"message": err.Error(), "cause": ..., "kind": "RuntimeError"}
 * という JSON にして `throw new Error(<JSON>)` する。そのため Error.message が JSON 文字列になる。
 * JSON なら中の message（Go の err.Error()）を、そうでなければ message そのものを返す。
 *
 * Binder は MessageError を扱う parseError（src/error.js）を使う。
 * これは MarshalError を登録していない Lite 向けの、err.Error() をそのまま出すためのもの。
 *
 * @param {unknown} err
 * @returns {string}
 */
export function errorMessage(err) {
  if (err == null) return '';
  const raw = (typeof err === 'object' && 'message' in err) ? err.message : err;
  if (typeof raw !== 'string') return String(raw);
  try {
    const env = JSON.parse(raw);
    if (env && typeof env === 'object' && typeof env.message === 'string') {
      return env.message.trim();
    }
  } catch {
    // JSON でない（フロント由来のエラー）
  }
  return raw.trim();
}

export default errorMessage;
