/**
 * 文字数を数える。
 *
 * 改行は数えない。絵文字やサロゲートペアの文字は 1 文字として数える。
 *
 * エディタが打鍵のたびに本文全体を数えるので、文字を 1 つずつ取り出す（for...of）のではなく
 * 符号単位を見て数える（数千行の本文で 1 桁速い）。サロゲートペアは後ろ半分を数えない。
 *
 * @param {string} text - 数える文字列
 * @returns {number} 文字数
 */
export function countChars(text) {
  if (!text) return 0;
  let n = 0;
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13) continue;
    n++;
    // 上位サロゲートの次が下位サロゲートなら、合わせて 1 文字
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < len) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) i++;
    }
  }
  return n;
}
