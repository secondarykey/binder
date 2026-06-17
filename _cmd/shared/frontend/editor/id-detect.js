const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * カーソル行に含まれる全 UUID を検出し、カーソルに近い順にソートして返す。
 *
 * @param {string} text - テキスト全体
 * @param {number} cursorPos - カーソル位置（selectionStart）
 * @returns {string[]} UUID 文字列の配列（カーソルに近い順）。見つからなければ空配列
 */
export function extractUuidsOnLine(text, cursorPos) {
  if (!text || cursorPos < 0) return [];

  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  let lineEnd = text.indexOf('\n', cursorPos);
  if (lineEnd === -1) lineEnd = text.length;

  const line = text.substring(lineStart, lineEnd);
  const matches = [];
  let m;
  UUID_PATTERN.lastIndex = 0;
  while ((m = UUID_PATTERN.exec(line)) !== null) {
    const absStart = lineStart + m.index;
    const absEnd = absStart + m[0].length;
    const distance = cursorPos >= absStart && cursorPos <= absEnd
      ? 0
      : Math.min(Math.abs(cursorPos - absStart), Math.abs(cursorPos - absEnd));
    matches.push({ uuid: m[0], distance });
  }

  matches.sort((a, b) => a.distance - b.distance);
  return matches.map((m) => m.uuid);
}

/**
 * 後方互換: カーソル行で最もカーソルに近い UUID を1つ返す。
 */
export function extractUuidAtCursor(text, cursorPos) {
  const uuids = extractUuidsOnLine(text, cursorPos);
  return uuids.length > 0 ? uuids[0] : null;
}
