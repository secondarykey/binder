/**
 * カーソル位置が {{ ... }} 内にある場合、最初のキーワード/関数名を返す。
 *
 * @param {string} text - テキスト全体
 * @param {number} cursorPos - カーソル位置（selectionStart）
 * @returns {string|null} 検出された関数名。見つからなければ null
 */
export function detectTemplateFunc(text, cursorPos) {
  if (!text || cursorPos < 0) return null;

  const before = text.substring(0, cursorPos);
  const openIdx = before.lastIndexOf('{{');
  if (openIdx === -1) return null;

  // {{ より後ろに }} があればカーソルはテンプレートブロック外
  const between = before.substring(openIdx + 2);
  if (between.includes('}}')) return null;

  // {{ の後のテキスト + カーソル以降で }} を探してブロック全体を取る
  const after = text.substring(cursorPos);
  const closeIdx = after.indexOf('}}');
  const blockEnd = closeIdx !== -1 ? cursorPos + closeIdx : text.length;
  const block = text.substring(openIdx + 2, blockEnd).trim();

  // ブロック先頭のキーワード抽出: "- " や "=" プレフィックスをスキップ
  let content = block;
  if (content.startsWith('-')) content = content.substring(1).trimStart();
  if (content.startsWith('=')) content = content.substring(1).trimStart();

  // 最初のトークン（スペースやドット区切りの前）を関数名として返す
  const match = content.match(/^([a-zA-Z_]\w*)/);
  return match ? match[1] : null;
}
