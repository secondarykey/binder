/**
 * 404 ページにするノート（alias が "/404"）の判定。
 *
 * このノートは docs/pages/ ではなく docs/404.html に公開され、GitHub Pages が存在しないパスへの
 * 応答に使う（Go 側 json.ErrorPageAlias。_docs/site-root-files.md フェーズ2）。
 */
import { publishSubDirOf } from "./rootAsset";

export const ERROR_PAGE_ALIAS = "/404";

/** 404 ページにするノートの alias か */
export function isErrorPageAlias(alias) {
  return alias === ERROR_PAGE_ALIAS;
}

/**
 * 「404 ページにする」を切り替えたあとの alias を返す。
 * 外すときは切り替える前の alias に戻す。それも 404 だったら（開いた時点で 404 ページ）ID に戻す
 * （新規作成時の alias と同じ）。
 */
export function toggleErrorPageAlias(checked, { alias, previous, id }) {
  if (checked) return ERROR_PAGE_ALIAS;
  if (!isErrorPageAlias(alias)) return alias;
  return previous && !isErrorPageAlias(previous) ? previous : id;
}

/**
 * 404 ページが効かない・崩れる置き方の警告を返す（保存は止めない）。
 *
 * - 公開データをサブディレクトリへ送る設定 → docs/404.html が公開元の直下にならず、GitHub Pages が使わない
 * - サイトの URL が分からない → 404 ページの URL をサイトのルートからのパスで書き出せず、深い階層のパスで崩れる
 *
 * @param {{ siteUrl: string, publishOnly: boolean, publishSubDir: string }} p
 * @returns {{ key: string, params: object }[]} 翻訳キーと差し込む値
 */
export function errorPageWarnings({ siteUrl, publishOnly, publishSubDir }) {
  const subDir = publishSubDirOf(publishOnly, publishSubDir);
  if (subDir) {
    return [{ key: "note.errorPageSubDir", params: { dir: subDir } }];
  }
  if (!siteUrl) {
    return [{ key: "note.errorPageNoSiteUrl", params: {} }];
  }
  return [];
}
