/**
 * 画像の貼り付け（Binder Lite）
 *
 * クリップボードの画像を取り出し、保存した画像を参照する Markdown を作る。
 * 保存そのものは呼び出し側（Go の SaveImage）が行う。
 */

// クリップボードの画像の MIME と、保存するときの拡張子
const IMAGE_EXTS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
};

/**
 * 貼り付けで受け取る画像を返す。無ければ null。
 *
 * 文字も一緒に入っているとき（表計算ソフトのセルなど、画像と文字の両方を載せるもの）は
 * 文字の貼り付けを優先し、画像としては扱わない。
 *
 * @param {DataTransfer} clipboardData
 * @returns {{ file: File, ext: string }|null}
 */
export function clipboardImage(clipboardData) {
  if (!clipboardData) return null;
  if (clipboardData.getData?.('text/plain')) return null;
  for (const item of Array.from(clipboardData.items || [])) {
    if (item.kind !== 'file') continue;
    const ext = IMAGE_EXTS[item.type];
    if (!ext) continue;
    const file = item.getAsFile();
    if (file) return { file, ext };
  }
  return null;
}

/**
 * File を base64（data URI の頭を除いたもの）にする。
 *
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.substring(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 画像の相対パスから、本文に入れる Markdown を作る。
 * 空白や括弧を含むパスは <> で囲む（CommonMark の書き方。そのままだとリンクが切れる）。
 *
 * @param {string} rel - 本文に書く相対パス（/ 区切り）
 * @returns {string}
 */
export function markdownImage(rel) {
  const dest = /[\s()<>]/.test(rel) ? `<${rel}>` : rel;
  return `![](${dest})`;
}

/**
 * プレビューで、Markdown ファイルからの相対パスとして読む画像かどうか。
 * URL・data: / blob:・ルート相対・# は読まない。
 *
 * @param {string} src - <img> の src 属性の値
 * @returns {boolean}
 */
export function isRelativeImageSrc(src) {
  const v = (src || '').trim();
  if (!v || v.startsWith('#') || v.startsWith('/') || v.startsWith('\\')) return false;
  // スキーム（http: data: など）。Windows のドライブ文字（C:）は 2 文字以上なので除く
  if (/^[a-z][a-z0-9+.-]+:/i.test(v)) return false;
  return true;
}
