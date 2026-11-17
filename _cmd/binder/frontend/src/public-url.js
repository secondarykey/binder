/**
 * 公開したものをプレビューサーバ（OS のブラウザ）で開くときの、サイトのルートからのパス。
 *
 * alias は必ず encodeURIComponent してから URL に入れる。
 * alias に使えない文字は "/" と "\" だけなので、空白・全角スペース・"<>"・"$" なども入りうる。
 * Wails の Browser.OpenURL はこれらを含む URL を拒否し（ValidateAndSanitizeURL）、
 * "%" は URL として読めず、"#" はそこから先がフラグメントになって別のページを開く。
 * プレビューサーバはパスをデコードしてから docs/ のファイルを探すので、エンコードしても同じファイルに届く。
 *
 * 公開先の規則は Go 側（fs.PublicAssetFile / HTMLFile）と同じ:
 * - ノート: index は "/"、alias が "/" で始まるもの（404 ページの "/404"）は "/404.html"、ほかは "/pages/<alias>.html"
 * - 図: "/images/<alias>.svg"、レイヤー: "/layers/<alias>.svg"
 * - アセット: alias が "/" で始まるもの（"/robots.txt"）はサイトのルート、ほかは "/assets/<alias>"
 *
 * @param {"note"|"diagram"|"layer"|"asset"} kind
 * @param {string} alias
 * @param {string} [id] ノートの ID（index の判定に使う）
 * @returns {string} パス。開けないもの（alias が空など）は ""
 */
export function publicPath(kind, alias, id) {
  if (kind === "note" && id === "index") return "/";
  if (!alias) return "";
  const root = alias.startsWith("/");
  const name = encodeURIComponent(root ? alias.slice(1) : alias);
  if (!name) return "";
  switch (kind) {
    case "note":
      return root ? `/${name}.html` : `/pages/${name}.html`;
    case "diagram":
      return `/images/${name}.svg`;
    case "layer":
      return `/layers/${name}.svg`;
    case "asset":
      return root ? `/${name}` : `/assets/${name}`;
    default:
      return "";
  }
}

export default publicPath;
