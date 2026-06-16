const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_CHARS = /[0-9a-fA-F-]/;

/**
 * カーソル位置の前後をスキャンし、UUID 文字列を抽出する。
 *
 * @param {string} text - テキスト全体
 * @param {number} cursorPos - カーソル位置（selectionStart）
 * @returns {string|null} UUID 文字列、または null
 */
export function extractUuidAtCursor(text, cursorPos) {
  if (!text || cursorPos < 0) return null;

  let start = cursorPos;
  while (start > 0 && UUID_CHARS.test(text[start - 1])) {
    start--;
  }

  let end = cursorPos;
  while (end < text.length && UUID_CHARS.test(text[end])) {
    end++;
  }

  const candidate = text.substring(start, end);
  const match = candidate.match(UUID_PATTERN);
  return match ? match[0] : null;
}
