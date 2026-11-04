/**
 * サイトのルートに置くアセット（alias の先頭が "/"）の判定。
 *
 * alias が "/robots.txt" なら docs/robots.txt、"robots.txt" なら docs/assets/robots.txt に公開される
 * （Go 側 fs.PublicAssetFile と同じ規則。_docs/site-root-files.md）。
 */

/** alias がサイトのルートに置くものか */
export function isRootAlias(alias) {
  return typeof alias === "string" && alias.startsWith("/");
}

/** alias から先頭の "/" を除いた名前（入力欄に出す部分） */
export function aliasName(alias) {
  return isRootAlias(alias) ? alias.slice(1) : (alias || "");
}

/** 入力欄の名前と「ルートに置く」から alias を組み立てる */
export function joinAlias(name, root) {
  // 入力欄に "/" を打った場合もルート扱いにする（二重の "/" にはしない）
  if (isRootAlias(name)) return name;
  return root ? "/" + name : name;
}

/**
 * 公開先を表示用に返す。サイトの URL が分かれば絶対 URL、分からなければ docs/ からのパス。
 * alias（名前）が空なら公開されないので空文字。
 */
export function publishLocation(alias, siteUrl) {
  // "/" だけ（名前が空）は保存できないので、サイトの URL そのものを出さない
  if (!aliasName(alias)) return "";
  const rel = isRootAlias(alias) ? aliasName(alias) : "assets/" + alias;
  if (siteUrl) {
    const base = siteUrl.endsWith("/") ? siteUrl : siteUrl + "/";
    return base + rel;
  }
  return "docs/" + rel;
}

/**
 * 公開データの送り先のサブディレクトリ（前後の区切りは外す）。docs だけを送る設定でなければ空。
 * 空でなければ docs 直下はサイトのルートにならない。
 */
export function publishSubDirOf(publishOnly, publishSubDir) {
  return publishOnly ? (publishSubDir || "").replace(/^[\\/]+|[\\/]+$/g, "") : "";
}

/** サイトの URL のパス部分（"https://u.github.io/repo/" → "/repo/"）。解釈できなければ null */
function sitePath(siteUrl) {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).pathname || "/";
  } catch {
    return null;
  }
}

/**
 * ルートに置いても効かない置き方の警告を返す（保存は止めない）。
 *
 * - 公開データをサブディレクトリへ送る設定 → docs 直下がサイトのルートにならない
 * - robots.txt をプロジェクトサイト（パスが "/" でない）に置く → ホストのルートでしか読まれない
 *
 * @param {{ alias: string, siteUrl: string, publishOnly: boolean, publishSubDir: string }} p
 * @returns {{ key: string, params: object }[]} 翻訳キーと差し込む値
 */
export function rootAssetWarnings({ alias, siteUrl, publishOnly, publishSubDir }) {
  if (!isRootAlias(alias)) return [];

  const subDir = publishSubDirOf(publishOnly, publishSubDir);
  if (subDir) {
    return [{ key: "asset.subDirIneffective", params: { dir: subDir } }];
  }

  if (aliasName(alias).toLowerCase() === "robots.txt") {
    const path = sitePath(siteUrl);
    if (path !== null && path !== "/") {
      return [{ key: "asset.robotsIneffective", params: { url: siteUrl } }];
    }
  }
  return [];
}
