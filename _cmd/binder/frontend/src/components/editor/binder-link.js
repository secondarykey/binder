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

// 相対リンクを解決する基準。
// テンプレートの .Link は公開時の階層に合わせて "../pages/x.html"（通常のノート）と
// "./pages/x.html"（docs/ 直下に置かれる index ノート）を出し分けるため、
// プレビュー中のノートがどちらかを frontend からは決められない。両方を順に試す
const BASES = ["http://binder.invalid/pages/", "http://binder.invalid/"];

/**
 * href をバインダー内のパスの候補へ正規化する。
 * クエリ・フラグメントは落とす。パスとして解釈できない場合は空配列を返す。
 */
export function toBinderPaths(href) {
  const paths = [];
  for (const base of BASES) {
    try {
      const path = new URL(href, base).pathname;
      if (!paths.includes(path)) paths.push(path);
    } catch {
      // noop（URLとして解釈できない基準は飛ばす）
    }
  }
  return paths;
}

/**
 * バインダー内リンクの遷移先URLを返す。
 * 解決できない場合（未登録のエイリアス・対象外のパス）は null を返す。
 *
 * @param {string} href プレビュー内のリンクの href
 * @returns {Promise<{url: string, id: string, typ: string}|null>}
 */
export async function resolveBinderLink(href) {
  for (const path of toBinderPaths(href)) {
    const s = await ResolveBinderLink(path);
    if (!s || !s.id) continue;

    const urlType = URL_TYPE[s.type];
    if (!urlType) return null;

    return { url: `/editor/${urlType}/${s.id}`, id: s.id, typ: s.type };
  }
  return null;
}
