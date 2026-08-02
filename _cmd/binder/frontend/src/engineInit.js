/**
 * Binder 固有のエンジン初期化（marked / mermaid の CDN 対応）。
 *
 * CDN URL はバインダーの設定（binder.json の markedUrl / mermaidUrl）にあるため、
 * 初期化はバインダーが開いていることが前提になる。**バインダー未オープン時に
 * 初期化を完了させてはならない**。内蔵版を載せると:
 *
 *   - marked:  isExists() が true になり、以降の ensureInit() が素通りする
 *   - mermaid: init() の先頭で globalThis.mermaid の存在チェックにより即 return する
 *
 * どちらもエンジンが内蔵版で固定され、その後バインダーを開いても CDN 指定が
 * 一切効かなくなる。起動時の「バインダーを開く」動作では main.jsx のウォームアップが
 * LoadBinder の完了前に走るため、この状態に必ず入っていた
 * （App.jsx の loadBinder は reset() → ensureInit() を行うが、reset() の後に
 * 進行中のウォームアップが内蔵版を載せてしまうと ensureInit() が素通りする）。
 *
 * そのため GetConfig() が null（＝バインダー未オープン）の間は何も載せずに戻り、
 * 判断を次の呼び出しへ委ねる。エンジンは未ロードのままなので、
 * バインダーを開いた後の ensureInit() / 初回描画で改めて初期化される。
 */

import Marked from '@shared/editor/engines/Marked'
import Mermaid from '@shared/editor/engines/Mermaid'
import Scripter from '@shared/editor/engines/Scripter'
import { GetConfig, GetAllowedCDNs, GetPlugins, GetPluginVerifiedMajors } from '../bindings/binder/api/app'

// 設定と許可 CDN 一覧は互いに依存しないため並列で取得する。
// バインダー未オープン時、GetConfig は null を返す（エラーではない）。
async function fetchConfig() {
  const [conf, allowedDomains] = await Promise.all([
    GetConfig().catch(() => null),
    GetAllowedCDNs().catch(() => []),
  ])
  return { conf, allowedDomains: allowedDomains || [] }
}

/** プラグインを取得し、現在の marked バージョンに応じて適用する */
export async function applyMarkedPlugins(cdnUrl) {
  try {
    const info = Marked.resolveMarkedInfo(cdnUrl)
    const [plugins, verified] = await Promise.all([
      GetPlugins("marked"),
      GetPluginVerifiedMajors("marked").catch(() => ({})),
    ])
    Marked.applyPlugins(plugins, info, verified || {})
  } catch (e) {
    console.warn("[Binder] Plugin load failed:", e)
  }
}

/**
 * marked の初期化。バインダー未オープンなら何も載せずに戻る。
 * @param {Function} origInit 共有エンジンの素の init（ベンダー版を読む）
 * @returns {Promise<boolean>} 初期化を行ったら true、見送ったら false
 */
export async function initMarked(origInit) {
  const { conf, allowedDomains } = await fetchConfig()

  // バインダー未オープン。内蔵版で確定させると CDN 指定が二度と効かなくなる
  if (!conf) {
    console.debug("[Binder] marked init skipped: no binder open")
    return false
  }

  let cdnUrl = conf.markedUrl || null

  // 「何を読もうとしたか」を記録する。ベンダー版へ黙って落ちた場合に
  // Marked.getEngineWarnings() が検出できるようにするため（CDN 指定は
  // バージョン固定の手段として使われるので、落ちたことに気付けないと困る）。
  const blocked = !!cdnUrl && !Scripter.isAllowedUrl(cdnUrl, allowedDomains)
  Marked.setEngineRequest({ url: cdnUrl, blocked })

  if (blocked) {
    console.warn("CDN URL not in allowed domains, falling back to vendor:", cdnUrl)
    cdnUrl = null
  }
  if (cdnUrl) {
    if (await Marked.tryLoadUrl(cdnUrl)) {
      await applyMarkedPlugins(cdnUrl)
      return true
    }
    console.warn("CDN URL failed, falling back to vendor")
  }
  await origInit()
  await applyMarkedPlugins(null)
  return true
}

/**
 * mermaid の初期化。URL 明示時はバインダー設定を見ない（呼び出し元が決めている）。
 * @param {Function} origInit 共有エンジンの素の init
 * @returns {Promise<boolean>} 初期化を行ったら true、見送ったら false
 */
export async function initMermaid(origInit, url, opts) {
  if (globalThis.mermaid !== undefined) return true

  let cdnUrl = url
  if (!cdnUrl) {
    const { conf, allowedDomains } = await fetchConfig()
    if (!conf) {
      console.debug("[Binder] mermaid init skipped: no binder open")
      return false
    }
    if (conf.mermaidUrl) cdnUrl = conf.mermaidUrl
    if (cdnUrl && !Scripter.isAllowedUrl(cdnUrl, allowedDomains)) {
      console.warn("CDN URL not in allowed domains, falling back to vendor:", cdnUrl)
      cdnUrl = null
    }
  }
  await origInit(cdnUrl, opts)
  return true
}

/** 共有エンジンの init を Binder 固有版で上書きする */
export function installEngineInit() {
  const origMarkedInit = Marked.init.bind(Marked)
  Marked.init = function() {
    return initMarked(origMarkedInit)
  }

  const origMermaidInit = Mermaid.init.bind(Mermaid)
  Mermaid.init = function(url, opts) {
    return initMermaid(origMermaidInit, url, opts)
  }
}
