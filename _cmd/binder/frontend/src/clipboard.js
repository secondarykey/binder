import { CopyToClipboard } from '../bindings/main/window';

/**
 * クリップボードのコピー
 *
 * App.jsx に置くと、ツリーやエディタの部品が App.jsx を import して循環する
 * （App → Content → エディタ → App）ので、ここに分けている。
 *
 * まず navigator.clipboard を使い、無いとき・失敗したときは Go 側（Window.CopyToClipboard）でコピーする。
 * Linux の配布版は Wails のページ（wails://）が安全なオリジンとして登録されておらず、
 * navigator.clipboard が無い可能性がある（wails3 dev の http://localhost では使える）。
 * どちらでもコピーできなければ reject する。呼ぶ側は .catch でエラーを出す（成功の表示は then の中で出す）。
 *
 * @param {string} val
 * @returns {Promise<void>}
 */
export async function copyClipboard(val) {
  const clip = globalThis.navigator?.clipboard;
  if (clip && typeof clip.writeText === 'function') {
    try {
      await clip.writeText(val);
      return;
    } catch (err) {
      // フォーカスが無い等で拒否されることがある。Go 側で試し直す
      console.warn('navigator.clipboard.writeText failed, falling back:', err);
    }
  }
  await CopyToClipboard(val);
}
