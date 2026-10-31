/**
 * 文字数を数える。
 *
 * 改行は数えない。絵文字やサロゲートペアの文字は 1 文字として数える。
 *
 * @param {string} text - 数える文字列
 * @returns {number} 文字数
 */
export function countChars(text) {
  if (!text) return 0;
  let n = 0;
  for (const ch of text) {
    if (ch !== '\n' && ch !== '\r') n++;
  }
  return n;
}
