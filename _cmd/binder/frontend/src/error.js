import i18n from 'i18next';

/**
 * Go/Wails から伝搬したエラー、またはフロントエンドのエラーを
 * ユーザ向けの { body, detail, debug, kind } に正規化する。
 *
 * Wails v3 はバインドメソッドの error を
 *   {"message": err.Error(), "cause": MarshalError(err), "kind": "RuntimeError"}
 * という envelope JSON にして返し、フロントは `throw new Error(<envelope>)` する。
 * そのため Error.message が envelope JSON 文字列になる。
 *
 * MessageError を返した場合、envelope.cause に {body, detail, kind, cause} が入る。
 * kind はメッセージ種別（"error" / "warning" / "info"）。省略時は呼び出し元の指定に従う。
 * それ以外（未変換の API エラー）は envelope.message の先頭行を body に使う。
 * JSON でない（フロント由来の文字列/t()）場合はそのまま body にする。
 *
 * Wails v3 は panic を recover して "<FQN>: panic: <value>" 形式の
 * RuntimeError にする。userError を経由しないため、ここで検出して
 * ユーザ向けメッセージに差し替える。
 *
 * @param {Error|string|object} err
 * @returns {{ body: string, detail: string, debug: string, kind: string|undefined }}
 */
export function parseError(err) {
  const isObj = err && typeof err === 'object';
  const raw = isObj && 'message' in err ? err.message : err;
  const stack = isObj ? err.stack : undefined;

  let body = '';
  let detail = '';
  let debug = stack || '';
  let kind;

  if (typeof raw === 'string') {
    let env = null;
    try { env = JSON.parse(raw); } catch (_) { env = null; }

    if (env && typeof env === 'object') {
      const cause = env.cause;
      if (cause && typeof cause === 'object' && !Array.isArray(cause) && cause.body) {
        // 構造化エラー（MessageError）
        body = cause.body;
        detail = cause.detail || '';
        kind = cause.kind || undefined;
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

  // Wails v3 の panic recovery: "<FQN>: panic: <value>" を検出
  if (body.includes(': panic:')) {
    debug = [body, detail, debug].filter(Boolean).join('\n');
    body = i18n.t('go.error.unexpected');
    detail = '';
  }

  return { body, detail, debug, kind };
}

export default parseError;
