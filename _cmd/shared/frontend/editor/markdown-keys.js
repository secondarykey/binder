/**
 * Markdown入力支援
 *
 * textarea の keydown イベントを処理し、Markdownの入力を支援する。
 * - リスト項目（- ）の自動継続
 * - チェックリスト（- [ ] ）の自動継続
 * - 引用（> ）の自動継続
 * - 番号リスト（1. ）の自動継続
 * - インデントの維持
 * - 空のプレフィックス行でEnterを押した場合のキャンセル
 *
 * textarea の value / selectionStart / selectionEnd のみに依存する純粋なロジック。
 */

/**
 * Enter キーで Markdown のリスト・引用プレフィックスを自動継続する。
 *
 * @param {HTMLTextAreaElement} textarea - 対象の textarea 要素
 * @returns {{ handled: boolean, value?: string, cursor?: number }}
 *   handled=true の場合、呼び出し元で value と cursor を適用する。
 */
export function handleMarkdownEnter(textarea) {
  const val = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const before = val.substring(0, start);
  const after = val.substring(end);

  let indent = "";
  let char = "";

  // 現在行のプレフィックスを解析
  const last = before.lastIndexOf('\n');
  const currentLine = last !== -1 ? before.substring(last + 1) : before;

  if (last !== -1) {
    const line = before.substring(last + 1);
    for (let idx = 0; idx < line.length; ++idx) {
      const c = line[idx];
      if (c !== " ") {
        if (c === "-") {
          char = "- ";
          const txt = line.substring(idx);
          if (txt.startsWith("- [ ]") || txt.startsWith("- [x]")) {
            char = "- [ ] ";
          }
        } else if (c === ">") {
          char = "> ";
        } else if (c === "1") {
          const c2 = line[idx + 1];
          if (c2 === ".") {
            char = "1. ";
          }
        }
        break;
      }
      indent += " ";
    }
  }

  // 空のリスト項目（プレフィックスのみの行）でEnterを押した場合はプレフィックスをキャンセル
  if (char && currentLine === indent + char) {
    const newBefore = before.substring(0, before.length - char.length);
    const cursor = newBefore.length;
    return {
      handled: true,
      value: newBefore + after,
      cursor,
    };
  }

  const insertion = "\n" + indent + char;
  const cursor = start + insertion.length;

  return {
    handled: true,
    value: before + insertion + after,
    cursor,
  };
}

/**
 * Ctrl+B / Ctrl+I / Ctrl+K でMarkdown書式を適用する。
 *
 * - 選択テキストがある場合、書式マーカーで囲む
 * - 選択テキストがない場合、プレースホルダ付きで挿入しプレースホルダを選択状態にする
 * - Ctrl+K（リンク）は選択テキストをリンクテキストとして使い、URL部分を選択状態にする
 *
 * @param {HTMLTextAreaElement} textarea - 対象の textarea 要素
 * @param {string} key - 押されたキー（'b', 'i', 'k'）
 * @returns {{ handled: boolean, value?: string, selectionStart?: number, selectionEnd?: number }}
 */
export function handleMarkdownFormat(textarea, key) {
  const val = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = val.substring(start, end);
  const before = val.substring(0, start);
  const after = val.substring(end);

  if (key === 'b') {
    if (selected) {
      const newVal = before + '**' + selected + '**' + after;
      return { handled: true, value: newVal, selectionStart: start + 2, selectionEnd: end + 2 };
    }
    const placeholder = 'text';
    const newVal = before + '**' + placeholder + '**' + after;
    return { handled: true, value: newVal, selectionStart: start + 2, selectionEnd: start + 2 + placeholder.length };
  }

  if (key === 'i') {
    if (selected) {
      const newVal = before + '*' + selected + '*' + after;
      return { handled: true, value: newVal, selectionStart: start + 1, selectionEnd: end + 1 };
    }
    const placeholder = 'text';
    const newVal = before + '*' + placeholder + '*' + after;
    return { handled: true, value: newVal, selectionStart: start + 1, selectionEnd: start + 1 + placeholder.length };
  }

  if (key === 'k') {
    const isUrl = selected && /^https?:\/\/\S+$/.test(selected);
    const linkText = isUrl ? 'text' : (selected || 'text');
    const linkUrl = isUrl ? selected : 'url';
    const newVal = before + '[' + linkText + '](' + linkUrl + ')' + after;
    if (isUrl) {
      const textStart = start + 1;
      return { handled: true, value: newVal, selectionStart: textStart, selectionEnd: textStart + linkText.length };
    }
    const urlStart = start + 1 + linkText.length + 2;
    return { handled: true, value: newVal, selectionStart: urlStart, selectionEnd: urlStart + linkUrl.length };
  }

  return { handled: false };
}

/**
 * Tab / Shift+Tab でインデント・アウトデントを行う。
 *
 * - 複数行選択: 各行の先頭にスペースを追加/削除
 * - 単一行（選択なし）: カーソル位置にスペースを挿入 / 行頭のスペースを削除
 *
 * @param {HTMLTextAreaElement} textarea - 対象の textarea 要素
 * @param {boolean} shiftKey - Shift が押されているか
 * @param {number} tabSize - タブ幅（スペース数）
 * @returns {{ handled: boolean, value?: string, selectionStart?: number, selectionEnd?: number }}
 */
export function handleMarkdownTab(textarea, shiftKey, tabSize) {
  const val = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const indent = ' '.repeat(tabSize);

  // 複数行選択の判定
  const selectedText = val.substring(start, end);
  const multiLine = selectedText.includes('\n');

  if (!shiftKey && !multiLine) {
    // 単一行 Tab: カーソル位置にスペース挿入
    const before = val.substring(0, start);
    const after = val.substring(end);
    const newVal = before + indent + after;
    const cursor = start + tabSize;
    return { handled: true, value: newVal, selectionStart: cursor, selectionEnd: cursor };
  }

  // 選択範囲を行境界に拡張
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = end;
  if (end > start && val[end - 1] === '\n') {
    lineEnd = end - 1;
  }
  const blockEnd = val.indexOf('\n', lineEnd);
  const actualEnd = blockEnd === -1 ? val.length : blockEnd;

  const block = val.substring(lineStart, actualEnd);
  const lines = block.split('\n');

  let newLines;
  let startDelta = 0;
  let totalDelta = 0;

  if (shiftKey) {
    // Shift+Tab: アウトデント
    newLines = lines.map((line, i) => {
      let removed = 0;
      for (let j = 0; j < tabSize && j < line.length; j++) {
        if (line[j] === ' ') {
          removed++;
        } else {
          break;
        }
      }
      if (i === 0) startDelta = -removed;
      totalDelta -= removed;
      return line.substring(removed);
    });
  } else {
    // Tab: インデント
    newLines = lines.map((line, i) => {
      if (i === 0) startDelta = tabSize;
      totalDelta += tabSize;
      return indent + line;
    });
  }

  const newBlock = newLines.join('\n');
  const before = val.substring(0, lineStart);
  const after = val.substring(actualEnd);
  const newVal = before + newBlock + after;

  const newStart = Math.max(lineStart, start + startDelta);
  const newEnd = Math.max(newStart, end + totalDelta);

  return { handled: true, value: newVal, selectionStart: newStart, selectionEnd: newEnd };
}

/**
 * textarea のキャレット位置が表示領域外にある場合、キャレットが見えるようスクロールする。
 *
 * Enter / Tab / 書式キーは preventDefault でブラウザ標準のキャレット追従スクロールを
 * 止めてしまうため、手動で value / selection を更新した後にこれを呼んでキャレットを
 * 可視範囲へ戻す（特に表示上の最終行で改行するとカーソルが画面外へ消える問題への対処）。
 *
 * textarea にはキャレット座標を直接取得する API が無いので、同じフォント・幅・折り返し条件の
 * ミラー要素を作り、キャレット位置にマーカーを挿入して offsetTop を実測する。
 *
 * @param {HTMLTextAreaElement} textarea - 対象の textarea 要素
 */
export function scrollCaretIntoView(textarea) {
  const val = textarea.value;
  const caret = textarea.selectionEnd;
  const cs = window.getComputedStyle(textarea);

  const paddingLeft = parseFloat(cs.paddingLeft) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const paddingTop = parseFloat(cs.paddingTop) || 0;
  const availWidth = textarea.clientWidth - paddingLeft - paddingRight;
  if (availWidth <= 0) return;

  const mirror = document.createElement('div');
  const s = mirror.style;
  s.position = 'absolute';
  s.top = '-9999px';
  s.left = '-9999px';
  s.visibility = 'hidden';
  s.boxSizing = 'content-box';
  s.padding = '0';
  s.border = '0';
  s.width = availWidth + 'px';
  s.height = 'auto';
  ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
    'letterSpacing', 'textTransform', 'tabSize'].forEach((p) => { s[p] = cs[p]; });
  s.whiteSpace = cs.whiteSpace === 'pre' ? 'pre' : 'pre-wrap';
  s.overflowWrap = 'break-word';
  s.wordBreak = cs.wordBreak;

  // キャレット位置にマーカーを置く。前後のテキストも付けることで折り返し計算を再現する。
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(document.createTextNode(val.substring(0, caret)));
  mirror.appendChild(marker);
  mirror.appendChild(document.createTextNode(val.substring(caret) || '​'));

  document.body.appendChild(mirror);
  const caretTop = marker.offsetTop; // content 座標（padding を含まない）
  const lineHeight = marker.offsetHeight || (parseFloat(cs.lineHeight) || 16);
  document.body.removeChild(mirror);

  // ミラーは padding 0 なので textarea のスクロール座標へ paddingTop を足して合わせる。
  const caretTopInTextarea = caretTop + paddingTop;
  const viewTop = textarea.scrollTop;
  const viewBottom = viewTop + textarea.clientHeight;

  if (caretTopInTextarea < viewTop) {
    textarea.scrollTop = caretTopInTextarea;
  } else if (caretTopInTextarea + lineHeight > viewBottom) {
    textarea.scrollTop = caretTopInTextarea + lineHeight - textarea.clientHeight;
  }
}

/**
 * textarea の keydown イベントハンドラ。
 * IME 入力中は無視し、Enter キーおよび Ctrl+B/I/K、Tab/Shift+Tab を処理する。
 *
 * @param {KeyboardEvent} e - keydown イベント
 * @param {React.MutableRefObject<boolean>} composingRef - IME入力中フラグ
 * @param {(value: string) => void} onChange - テキスト変更コールバック
 * @returns {boolean} イベントを処理した場合 true
 */
export function handleMarkdownKeyDown(e, composingRef, onChange, tabSize = 4) {
  if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) {
    return false;
  }

  // Ctrl+B / Ctrl+I / Ctrl+K
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'b' || key === 'i' || key === 'k') {
      e.preventDefault();
      const textarea = e.target;
      const result = handleMarkdownFormat(textarea, key);
      if (result.handled) {
        textarea.value = result.value;
        textarea.selectionStart = result.selectionStart;
        textarea.selectionEnd = result.selectionEnd;
        onChange(result.value);
        requestAnimationFrame(() => {
          textarea.selectionStart = result.selectionStart;
          textarea.selectionEnd = result.selectionEnd;
          scrollCaretIntoView(textarea);
        });
      }
      return true;
    }
  }

  // Tab / Shift+Tab
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const textarea = e.target;
    const result = handleMarkdownTab(textarea, e.shiftKey, tabSize);
    if (result.handled) {
      textarea.value = result.value;
      textarea.selectionStart = result.selectionStart;
      textarea.selectionEnd = result.selectionEnd;
      onChange(result.value);
      requestAnimationFrame(() => {
        textarea.selectionStart = result.selectionStart;
        textarea.selectionEnd = result.selectionEnd;
        scrollCaretIntoView(textarea);
      });
    }
    return true;
  }

  if (e.key !== "Enter") {
    return false;
  }

  e.preventDefault();

  const textarea = e.target;
  const result = handleMarkdownEnter(textarea);

  if (result.handled) {
    textarea.value = result.value;
    textarea.selectionStart = result.cursor;
    textarea.selectionEnd = result.cursor;
    onChange(result.value);
    requestAnimationFrame(() => {
      textarea.selectionStart = result.cursor;
      textarea.selectionEnd = result.cursor;
      scrollCaretIntoView(textarea);
    });
  }

  return true;
}
