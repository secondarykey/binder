/**
 * Go/Wails から伝搬したエラー、またはフロントエンドのエラーを
 * ユーザ向けの { body, detail, debug } に正規化する。
 *
 * Wails v3 はバインドメソッドの error を
 *   {"message": err.Error(), "cause": MarshalError(err), "kind": "RuntimeError"}
 * という envelope JSON にして返し、フロントは `throw new Error(<envelope>)` する。
 * そのため Error.message が envelope JSON 文字列になる。
 *
 * msgerr.MessageError を返した場合、envelope.cause に {body, detail, cause} が入る。
 * それ以外（未変換の API エラー）は envelope.message の先頭行を body に使う。
 * JSON でない（フロント由来の文字列/t()）場合はそのまま body にする。
 *
 * @param {Error|string|object} err
 * @returns {{ body: string, detail: string, debug: string }}
 */
export function parseError(err) {
  const isObj = err && typeof err === 'object';
  const raw = isObj && 'message' in err ? err.message : err;
  const stack = isObj ? err.stack : undefined;

  let body = '';
  let detail = '';
  let debug = stack || '';

  if (typeof raw === 'string') {
    let env = null;
    try { env = JSON.parse(raw); } catch (_) { env = null; }

    if (env && typeof env === 'object') {
      const cause = env.cause;
      if (cause && typeof cause === 'object' && !Array.isArray(cause) && cause.body) {
        // 構造化エラー（msgerr.MessageError）
        body = cause.body;
        detail = cause.detail || '';
        debug = [cause.cause, stack].filter(Boolean).join('\n') || raw;
      } else if (typeof env.message === 'string') {
        // 未変換の Go エラー: 先頭行を body、残り（スタック等）は detail/debug へ
        const lines = env.message.split('\n');
        body = lines[0];
        detail = lines.slice(1).join('\n').trim();
        debug = [env.message, stack].filter(Boolean).join('\n');
      } else {
        body = raw;
      }
    } else {
      // JSON でない文字列（フロント由来の文字列・t() の翻訳結果など）
      const lines = raw.split('\n');
      body = lines[0];
      detail = lines.slice(1).join('\n').trim();
      if (!debug) debug = '';
    }
  } else if (raw == null) {
    body = '';
  } else {
    body = String(raw);
  }

  if (!body) body = 'Unknown error';
  return { body, detail, debug };
}

export default parseError;
