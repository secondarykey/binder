/**
 * カーソル位置が {{ ... }} 内にある場合、関数名とカーソルが位置する引数インデックスを返す。
 *
 * @param {string} text - テキスト全体
 * @param {number} cursorPos - カーソル位置（selectionStart）
 * @returns {{ name: string, argIndex: number }|null}
 *   name: 検出された関数名
 *   argIndex: カーソルが位置する引数のインデックス（0始まり）。関数名上なら -1
 */
export function detectTemplateFunc(text, cursorPos) {
  if (!text || cursorPos < 0) return null;

  const before = text.substring(0, cursorPos);
  const openIdx = before.lastIndexOf('{{');
  if (openIdx === -1) return null;

  const between = before.substring(openIdx + 2);
  if (between.includes('}}')) return null;

  const after = text.substring(cursorPos);
  const closeIdx = after.indexOf('}}');
  const blockEnd = closeIdx !== -1 ? cursorPos + closeIdx : text.length;
  const block = text.substring(openIdx + 2, blockEnd);

  let content = block;
  let prefixLen = 0;
  const trimmed = content.replace(/^(\s*)/, '');
  prefixLen += content.length - trimmed.length;
  content = trimmed;
  if (content.startsWith('-') || content.startsWith('=')) {
    content = content.substring(1);
    prefixLen += 1;
    const trimmed2 = content.replace(/^(\s*)/, '');
    prefixLen += content.length - trimmed2.length;
    content = trimmed2;
  }

  const match = content.match(/^([a-zA-Z_]\w*)/);
  if (!match) return null;

  const name = match[1];
  const cursorInBlock = cursorPos - (openIdx + 2) - prefixLen;

  if (cursorInBlock <= match[0].length) {
    return { name, argIndex: -1 };
  }

  // 関数名以降の部分でカーソル位置までのテキストからトークン数を数える
  const afterFunc = content.substring(match[0].length);
  const cursorInArgs = cursorInBlock - match[0].length;
  const textBeforeCursor = afterFunc.substring(0, Math.max(0, cursorInArgs));
  const argIndex = countTokens(textBeforeCursor);

  // 引数のトークン一覧を抽出（呼び出し元で内部関数の判定に使用）
  const tokens = parseTokens(afterFunc.trim());

  return { name, argIndex, tokens };
}

/**
 * スペース区切りのトークン文字列を配列として返す（引用符を考慮）。
 */
function parseTokens(text) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      current += ch;
      if (ch === '\\' && i + 1 < text.length) { current += text[++i]; continue; }
      if (ch === quoteChar) inQuote = false;
      continue;
    }
    if (ch === '"' || ch === '`') { inQuote = true; quoteChar = ch; current += ch; continue; }
    if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * スペース区切りトークン数を数える（引用符内のスペースは無視）。
 * カーソルまでに完了したトークン数 = 引数インデックス。
 */
function countTokens(text) {
  let count = 0;
  let inQuote = false;
  let quoteChar = '';
  let hasContent = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '\\' && i + 1 < text.length) {
        i++;
        continue;
      }
      if (ch === quoteChar) {
        inQuote = false;
      }
      continue;
    }

    if (ch === '"' || ch === '`') {
      inQuote = true;
      quoteChar = ch;
      hasContent = true;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      if (hasContent) {
        count++;
        hasContent = false;
      }
      continue;
    }

    hasContent = true;
  }

  return count;
}
