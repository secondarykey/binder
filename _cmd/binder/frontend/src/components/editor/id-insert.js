/**
 * ID挿入（Ctrl+T）で入れる文字列を作る。
 *
 * ノートの本文では、種類に合わせたテンプレート関数まで入れる。
 * - ノート・画像以外のアセット: {{link "ID"}}
 * - ダイアグラム: {{drawDiagram "ID"}}
 * - 画像のアセット: {{assetsImage "ID"}}
 * - レイヤー: {{drawLayer "ID"}}
 * カーソルが {{ }} の中にあるとき（関数の引数を書いているところ）は ID だけを入れる。
 */

/**
 * カーソル位置が {{ }} の中にあるかを返す。
 *
 * @param {string} text - テキスト全体
 * @param {number} pos - カーソル位置
 * @returns {boolean}
 */
export function isInsideTemplate(text, pos) {
  if (!text || pos <= 0) return false;
  const before = text.substring(0, pos);
  return before.lastIndexOf('{{') > before.lastIndexOf('}}');
}

/**
 * ID一覧の項目から、本文に入れる文字列を返す。
 *
 * @param {{ id: string, type?: string, mime?: string }} item - ID一覧の項目
 * @param {boolean} withFunc - テンプレート関数まで入れるか
 * @returns {string}
 */
export function idInsertText(item, withFunc) {
  if (!withFunc) return item.id;
  switch (item.type) {
    case 'note':
      return `{{link "${item.id}"}}`;
    case 'diagram':
      return `{{drawDiagram "${item.id}"}}`;
    case 'layer':
      return `{{drawLayer "${item.id}"}}`;
    case 'asset':
      if ((item.mime || '').startsWith('image/')) {
        return `{{assetsImage "${item.id}"}}`;
      }
      return `{{link "${item.id}"}}`;
    default:
      return item.id;
  }
}
