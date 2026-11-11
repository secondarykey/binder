// Markdown の表まわりの変換（貼り付けたタブ区切りを表にする・カーソル位置の表を見つける）。

/**
 * タブ区切りテキストをMarkdownテーブルに変換する
 * Excel等からの貼り付けデータを想定。
 * 判定条件: 2行以上、各行にタブが1つ以上、全行のタブ数（列数）が一致
 * @param {string} text
 * @returns {string|null} Markdownテーブル文字列。タブ区切りでなければ null
 */
export function tsvToMarkdownTable(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
  if (lines.length < 2) return null;

  const tabCounts = lines.map(line => (line.match(/\t/g) || []).length);
  if (tabCounts[0] === 0) return null;
  if (!tabCounts.every(c => c === tabCounts[0])) return null;

  const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
  const colCount = rows[0].length;

  const header = '| ' + rows[0].join(' | ') + ' |';
  const separator = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
  const body = rows.slice(1).map(row => {
    while (row.length < colCount) row.push('');
    return '| ' + row.join(' | ') + ' |';
  });

  return [header, separator, ...body].join('\n');
}

/**
 * カーソル位置からマークダウンテーブルの範囲を検出する
 * @param {string} fullText
 * @param {number} cursorPos
 * @returns {{ startOffset: number, endOffset: number, lines: string[] } | null}
 */
export function detectTableAt(fullText, cursorPos) {
  const allLines = fullText.split("\n");
  let offset = 0;
  let cursorLineIdx = -1;

  for (let i = 0; i < allLines.length; i++) {
    const lineEnd = offset + allLines[i].length;
    if (cursorPos <= lineEnd) {
      cursorLineIdx = i;
      break;
    }
    offset = lineEnd + 1;
  }

  if (cursorLineIdx < 0) return null;
  if (!allLines[cursorLineIdx].trimStart().startsWith("|")) return null;

  let startLine = cursorLineIdx;
  while (startLine > 0 && allLines[startLine - 1].trimStart().startsWith("|")) {
    startLine--;
  }

  let endLine = cursorLineIdx;
  while (endLine < allLines.length - 1 && allLines[endLine + 1].trimStart().startsWith("|")) {
    endLine++;
  }

  const tableLines = allLines.slice(startLine, endLine + 1);
  if (tableLines.length < 2) return null;
  if (!/^\|[-:| ]+\|$/.test(tableLines[1].trim())) return null;

  const startOffset =
    allLines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0);
  const endOffset = startOffset + tableLines.join("\n").length;

  return { startOffset, endOffset, lines: tableLines };
}
