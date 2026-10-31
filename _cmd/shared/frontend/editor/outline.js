/**
 * Markdown の見出し（アウトライン）を扱う。
 *
 * - エディタのアウトライン表示: extractHeadings で本文から見出しを拾う
 * - プレビューの見出しから元の行へ飛ぶ: findHeadingLine で見出しの文字から行を探す
 *
 * 見出しは「# 見出し」の形（ATX）だけを拾う。``` / ~~~ で囲んだコードの中は除く。
 */

/**
 * 見出しの文字を比べられる形にする（前後の空白を落とし、続く空白を 1 つにする）。
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeHeadingText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/**
 * 見出しの Markdown から、プレビューに出る文字に近いものを作る。
 * 強調・打ち消し・コード・リンク・画像・HTML タグ・エスケープを落とす。
 *
 * @param {string} raw - 「#」と閉じの「#」を除いた見出しの本文
 * @returns {string}
 */
export function headingPlainText(raw) {
  let s = raw || '';
  s = s.replace(/`+([^`]*)`+/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/(\*\*|~~)(.+?)\1/g, '$2');
  s = s.replace(/\*(.+?)\*/g, '$1');
  // _ は単語の中（snake_case など）では強調にならない
  s = s.replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1$2');
  s = s.replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2');
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~|<>])/g, '$1');
  return normalizeHeadingText(s);
}

/**
 * 本文から見出しを拾う。
 *
 * @param {string} text - 本文
 * @returns {{ level: number, text: string, line: number }[]} line は 1 始まり
 */
export function extractHeadings(text) {
  const headings = [];
  if (!text) return headings;

  const lines = text.split('\n');
  let fence = null; // 開いているコードの囲み（``` か ~~~ と、その長さ）

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');

    const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) {
        fence = null;
      }
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }

    const m = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/);
    if (!m) continue;
    const plain = headingPlainText(m[2] || '');
    if (!plain) continue;
    headings.push({ level: m[1].length, text: plain, line: i + 1 });
  }
  return headings;
}

/**
 * プレビューで押された見出しに当たる、本文の行を返す。
 *
 * 同じ文字の見出しのうち何番目か（occurrence）で本文の見出しを探す。
 * テンプレートで行が増減すると data-src-line（srcLine）はずれるため、文字で探すのを先にする。
 * 見つからなければ（テンプレートの値が入った見出しなど）srcLine を使う。
 *
 * @param {{ text: string, line: number }[]} headings - extractHeadings の結果
 * @param {{ text: string, occurrence?: number, srcLine?: number|null }} target
 * @returns {number|null} 1 始まりの行。分からなければ null
 */
export function findHeadingLine(headings, target) {
  const text = normalizeHeadingText(target.text);
  const same = headings.filter((h) => h.text === text);
  const n = target.occurrence || 0;
  if (n < same.length) return same[n].line;
  return target.srcLine || null;
}
