/**
 * marked プラグインのメタデータ解析とバージョン互換判定。
 *
 * プラグイン先頭のコメント行で宣言されたメタデータを解釈する:
 *   /* @plugin-name: Keyboard Tag *\/
 *   /* @plugin-version: 1.0.0 *\/
 *   /* @marked: >=14 <19 *\/
 *
 * `@marked` は marked の互換レンジ（空白区切りの AND）。対応演算子は >= > <= < =。
 * `^` や `~` は解釈揺れを避けるため非対応。演算子なしの整数（例: `14`）はメジャー一致。
 *
 * バンドル・CDN・Lite 共通で使うため副作用を持たない純関数のみを置く。
 */

// 先頭コメントを走査する行数の上限（本文の @marked 等を誤検出しないため）
const HEAD_LINES = 40;

/**
 * プラグインソースからメタデータを抽出する。
 * @param {string} source プラグイン JS のソース
 * @returns {{ name: string|null, version: string|null, marked: string|null }}
 */
export function parsePluginMeta(source) {
  const meta = { name: null, version: null, marked: null };
  if (!source || typeof source !== 'string') return meta;

  const head = source.split('\n').slice(0, HEAD_LINES).join('\n');
  // /* @key: value */ 形式と // @key: value 形式の両方を許可する
  const re = /\/\*\s*@([\w-]+)\s*:\s*([\s\S]*?)\s*\*\/|\/\/\s*@([\w-]+)\s*:\s*(.*)$/gm;
  let m;
  while ((m = re.exec(head)) !== null) {
    const key = (m[1] || m[3] || '').toLowerCase();
    const val = (m[2] != null ? m[2] : m[4] != null ? m[4] : '').trim();
    if (key === 'plugin-name' && meta.name == null) meta.name = val;
    else if (key === 'plugin-version' && meta.version == null) meta.version = val;
    else if (key === 'marked' && meta.marked == null) meta.marked = val;
  }
  return meta;
}

/**
 * "14" / "14.1" / "14.1.4" などを [major, minor, patch] に正規化する。
 * 欠けた要素は 0 で埋める。数値化できない要素は 0 扱い。
 * @param {string|number} v
 * @returns {number[]} 長さ3の配列
 */
export function parseVersion(v) {
  if (v == null) return [0, 0, 0];
  const parts = String(v).trim().replace(/^v/i, '').split('.');
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const n = parseInt(parts[i], 10);
    out[i] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/**
 * セマンティックバージョンを比較する。a<b:-1, a==b:0, a>b:1。
 * 比較は与えられた粒度ではなく常に [major,minor,patch] で行う。
 */
export function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * 単一コンパレータ（例: ">=14", "<19", "14"）を評価する。
 * @param {string} token
 * @param {string} version 判定対象のバージョン文字列
 * @returns {boolean}
 */
function satisfiesComparator(token, version) {
  const t = token.trim();
  if (!t) return true;

  const m = t.match(/^(>=|<=|>|<|=)?\s*(.+)$/);
  if (!m) return false;
  const op = m[1] || '';
  const rhs = m[2].trim();

  // 演算子なしの「整数のみ」はメジャー一致として扱う（例: "14" は marked 14 系）
  if (op === '' && /^\d+$/.test(rhs)) {
    return parseVersion(version)[0] === parseInt(rhs, 10);
  }

  const cmp = compareVersions(version, rhs);
  switch (op) {
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
    case '>':  return cmp > 0;
    case '<':  return cmp < 0;
    case '=':
    case '':   return cmp === 0;
    default:   return false;
  }
}

/**
 * `@marked` レンジ（空白区切りの AND）を評価する。
 * @param {string} range 例: ">=14 <19"
 * @param {string} version 判定対象のバージョン文字列
 * @returns {boolean} レンジを満たせば true。range が空なら true（制約なし）
 */
export function satisfiesRange(range, version) {
  if (!range || !String(range).trim()) return true;
  const tokens = String(range).trim().split(/\s+/);
  return tokens.every(tok => satisfiesComparator(tok, version));
}

/**
 * プラグインの互換状態を判定する。
 *
 * - marked のバージョンが不明（major が null）な場合は判定不能として 'unknown' を返す。
 * - `@marked` 宣言がある場合はレンジ判定（compatible / incompatible）。
 * - `@marked` 宣言がない場合は、記録された検証時メジャー verifiedMajor と現在のメジャーを
 *   比較し、一致すれば 'compatible'、不一致なら 'unverified'、記録がなければ 'undeclared'。
 *
 * @param {{ marked: string|null }} meta parsePluginMeta の結果
 * @param {{ version: string|null, major: number|null }} markedInfo 現在の marked 情報
 * @param {number|null} [verifiedMajor] このプラグインを検証（追加・更新）した時点の marked メジャー
 * @returns {'compatible'|'incompatible'|'undeclared'|'unverified'|'unknown'}
 */
export function pluginCompatStatus(meta, markedInfo, verifiedMajor) {
  const major = markedInfo ? markedInfo.major : null;

  if (meta && meta.marked) {
    if (major == null && (!markedInfo || !markedInfo.version)) return 'unknown';
    const ver = (markedInfo && markedInfo.version) || (major != null ? String(major) : null);
    if (ver == null) return 'unknown';
    return satisfiesRange(meta.marked, ver) ? 'compatible' : 'incompatible';
  }

  // 未宣言
  if (verifiedMajor == null) return 'undeclared';
  if (major == null) return 'unknown';
  return verifiedMajor === major ? 'compatible' : 'unverified';
}

/**
 * 互換状態を「適用してよいか」に落とす。
 * incompatible のみ適用しない。unknown/unverified/undeclared は適用する（後方互換優先・警告付き）。
 * @param {ReturnType<typeof pluginCompatStatus>} status
 * @returns {boolean}
 */
export function shouldApply(status) {
  return status !== 'incompatible';
}
