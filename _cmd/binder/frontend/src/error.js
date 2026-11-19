import i18n from 'i18next';

/**
 * Go/Wails から伝搬したエラー、またはフロントエンドのエラーを
 * ユーザ向けの { body, detail, debug, kind } に正規化する。
 *
 * Wails v3 はバインドメソッドの error を
 *   {"message": err.Error(), "cause": MarshalError(err), "kind": "RuntimeError"}
 * という envelope JSON にして返す。フロントが受け取る形は @wailsio/runtime の版で 2 通りある:
 *   - 今の runtime（3.0.0-alpha2.x）: 応答が application/json なら
 *     `new RuntimeError(envelope.message)` に `err.cause = envelope.cause` を付けて投げる。
 *     Error.message は本文（err.Error()）だけで、構造は err.cause（オブジェクト）にある
 *   - それ以外: `throw new Error(<envelope>)`。Error.message が envelope JSON 文字列になる
 * 両方を読む（err.cause を先に見る）。前者を読み落とすと、本文は出るが kind / detail / code が取れない。
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
 * @returns {{ body: string, detail: string, debug: string, kind: string|undefined, code: string|undefined }}
 */
export function parseError(err) {
  const isObj = err && typeof err === 'object';
  const raw = isObj && 'message' in err ? err.message : err;
  const stack = isObj ? err.stack : undefined;

  let body = '';
  let detail = '';
  let debug = stack || '';
  let kind;
  // code: 原因を見分ける符号（MessageError.Code）。本文は言語で変わるので、画面の動きを変えるときはこれを見る
  let code;

  // 今の runtime: 構造化エラー（MessageError）は err.cause に入っている
  const direct = isObj ? structuredCause(err.cause) : null;

  if (direct) {
    body = direct.body;
    detail = direct.detail || '';
    kind = direct.kind || undefined;
    code = direct.code || undefined;
    debug = [direct.cause, stack].filter(Boolean).join('\n') || (typeof raw === 'string' ? raw : '');
  } else if (typeof raw === 'string') {
    let env = null;
    try { env = JSON.parse(raw); } catch (_) { env = null; }

    if (env && typeof env === 'object') {
      const cause = env.cause;
      if (cause && typeof cause === 'object' && !Array.isArray(cause) && cause.body) {
        // 構造化エラー（MessageError）
        body = cause.body;
        detail = cause.detail || '';
        kind = cause.kind || undefined;
        code = cause.code || undefined;
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

  return { body, detail, debug, kind, code };
}

/**
 * err.cause が MessageError の中身（{body, detail, kind, code, cause}）ならそれを返す。
 * 文字列の JSON で来ても読む。それ以外（未変換のエラー・JS の Error の cause など）は null。
 */
function structuredCause(cause) {
  let c = cause;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch (_) { return null; }
  }
  if (c && typeof c === 'object' && !Array.isArray(c) && typeof c.body === 'string' && c.body) {
    return c;
  }
  return null;
}

export default parseError;
