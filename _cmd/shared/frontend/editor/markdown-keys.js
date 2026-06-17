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
 * textarea の keydown イベントハンドラ。
 * IME 入力中は無視し、Enter キーおよび Ctrl+B/I/K を処理する。
 *
 * @param {KeyboardEvent} e - keydown イベント
 * @param {React.MutableRefObject<boolean>} composingRef - IME入力中フラグ
 * @param {(value: string) => void} onChange - テキスト変更コールバック
 * @returns {boolean} イベントを処理した場合 true
 */
export function handleMarkdownKeyDown(e, composingRef, onChange) {
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
        });
      }
      return true;
    }
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
    });
  }

  return true;
}
