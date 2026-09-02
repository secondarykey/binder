import { ResolveBinderLink } from "../../../bindings/binder/api/app";

/**
 * プレビュー内のバインダー内リンクをエディタの遷移先へ変換する。
 *
 * 公開HTMLのリンクは /pages/<alias>.html のようなエイリアス表記のため、
 * Go 側（ResolveBinderLink）で structures を引いて実体のIDを得る。
 */

// リンク種別ごとのエディタURL。asset だけ URL とモード名が異なる（App.jsx の履歴と同じ規則）
const URL_TYPE = Object.freeze({
  note: "note",
  diagram: "diagram",
  layer: "layer",
  asset: "assets",
});

/**
 * href をバインダー内のパスへ正規化する。
 *
 * プレビューのノートは公開時に /pages/ 配下へ置かれるため、
 * 相対リンクもそこを基準に解決する。クエリ・フラグメントは落とす。
 * パスとして解釈できない場合は null を返す。
 */
export function toBinderPath(href) {
  try {
    return new URL(href, "http://binder.invalid/pages/").pathname;
  } catch {
    return null;
  }
}

/**
 * バインダー内リンクの遷移先URLを返す。
 * 解決できない場合（未登録のエイリアス・対象外のパス）は null を返す。
 *
 * @param {string} href プレビュー内のリンクの href
 * @returns {Promise<{url: string, id: string, typ: string}|null>}
 */
export async function resolveBinderLink(href) {
  const path = toBinderPath(href);
  if (!path) return null;

  const s = await ResolveBinderLink(path);
  if (!s || !s.id) return null;

  const urlType = URL_TYPE[s.type];
  if (!urlType) return null;

  return { url: `/editor/${urlType}/${s.id}`, id: s.id, typ: s.type };
}
