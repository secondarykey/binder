/**
 * クリップボードのコピー
 *
 * App.jsx に置くと、ツリーやエディタの部品が App.jsx を import して循環する
 * （App → Content → エディタ → App）ので、ここに分けている。
 * @param {*} val
 */
export async function copyClipboard(val) {

  var clip = navigator.clipboard;
  if (clip === undefined) {
    if (global !== undefined) {
      clip = global.navigator.clipboard;
    }
  }

  if (clip !== undefined) {
    await clip.writeText(val);
  } else {
    console.warn("clip board error")
  }
}
