import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/style.css'
import App from './app/App'
import HistoryApp from './app/HistoryApp'
import OverallHistoryApp from './app/OverallHistoryApp'
import PreviewApp from './app/PreviewApp'
import SyslogApp from './app/SyslogApp'
import SearchApp from './app/SearchApp'

import { GetTheme, GetLanguage, GetConfig, GetAllowedCDNs, GetPlugins } from '../bindings/binder/api/app'
import { applyTheme } from './theme'
import { loadLanguage } from './language'

// 共有エンジンにベンダー URL を設定
import Marked from '@shared/editor/engines/Marked'
import Mermaid from '@shared/editor/engines/Mermaid'
import Scripter from '@shared/editor/engines/Scripter'
import markedVendorUrl from './assets/vendor/marked.min.js?url'
import mermaidVendorUrl from './assets/vendor/mermaid.min.js?url'
Marked.setVendorUrl(markedVendorUrl)
Mermaid.setVendorUrl(mermaidVendorUrl)

// Binder固有: CDN対応の init を上書き
const origMarkedInit = Marked.init.bind(Marked)
Marked.init = async function() {
  let cdnUrl = null
  // 設定と許可 CDN 一覧は互いに依存しないため並列で取得する
  const [conf, allowedDomains] = await Promise.all([
    GetConfig().catch(() => null),
    GetAllowedCDNs().catch(() => []),
  ])
  if (conf && conf.markedUrl) cdnUrl = conf.markedUrl
  if (cdnUrl && !Scripter.isAllowedUrl(cdnUrl, allowedDomains || [])) {
    console.warn("CDN URL not in allowed domains, falling back to vendor:", cdnUrl)
    cdnUrl = null
  }
  if (cdnUrl) {
    if (await Marked.tryLoadUrl(cdnUrl)) {
      try {
        const plugins = await GetPlugins("marked")
        Marked.applyPlugins(plugins)
      } catch (e) {
        console.warn("[Binder] Plugin load failed:", e)
      }
      return
    }
    console.warn("CDN URL failed, falling back to vendor")
  }
  await origMarkedInit()
  try {
    const plugins = await GetPlugins("marked")
    Marked.applyPlugins(plugins)
  } catch (e) {
    console.warn("[Binder] Plugin load failed:", e)
  }
}

const origMermaidInit = Mermaid.init.bind(Mermaid)
Mermaid.init = async function(url, opts) {
  if (globalThis.mermaid !== undefined) return
  let cdnUrl = url
  if (!cdnUrl) {
    // 設定と許可 CDN 一覧は互いに依存しないため並列で取得する
    const [conf, allowedDomains] = await Promise.all([
      GetConfig().catch(() => null),
      GetAllowedCDNs().catch(() => []),
    ])
    if (conf && conf.mermaidUrl) cdnUrl = conf.mermaidUrl
    if (cdnUrl && !Scripter.isAllowedUrl(cdnUrl, allowedDomains || [])) {
      console.warn("CDN URL not in allowed domains, falling back to vendor:", cdnUrl)
      cdnUrl = null
    }
  }
  await origMermaidInit(cdnUrl, opts)
}

// 未捕捉の Promise rejection をスナックバーに表示する安全ネット
import { defaultEvent } from './Event'
window.addEventListener('unhandledrejection', (e) => {
  defaultEvent.showErrorMessage(e.reason);
});

const container = document.getElementById('root')
const root = createRoot(container)

const params = new URLSearchParams(window.location.search);
const isCommitWindow          = params.get('commit')         === '1';
const isHistoryWindow         = params.get('history')        === '1';
const isOverallHistoryWindow  = params.get('overallHistory') === '1';
const isPreviewWindow         = params.get('preview')        === '1';
const isSyslogWindow          = params.get('syslog')         === '1';
const isSearchWindow          = params.get('search')         === '1';

// テーマと言語を動的に読み込んでからレンダリング
Promise.all([
  GetTheme().then(t => applyTheme(t || 'dark')).catch(() => applyTheme('dark')),
  GetLanguage().then(l => loadLanguage(l || 'en')).catch(() => loadLanguage('en')),
]).then(() => {
  root.render(
      <React.StrictMode>
        <HashRouter>
          {isSearchWindow ? <SearchApp /> : isSyslogWindow ? <SyslogApp /> : isPreviewWindow ? <PreviewApp /> : isOverallHistoryWindow ? <OverallHistoryApp /> : isHistoryWindow ? <HistoryApp /> : <App />}
        </HashRouter>
      </React.StrictMode>
  )

  // メインウィンドウではアイドル時にエンジンを先読み初期化し、
  // 初回プレビュー時のベンダー JS ロード + 設定取得の待ちをなくす
  const isMainWindow = !isCommitWindow && !isHistoryWindow && !isOverallHistoryWindow
    && !isPreviewWindow && !isSyslogWindow && !isSearchWindow;
  if (isMainWindow) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
    idle(() => {
      Marked.ensureInit().catch(() => {});
      Mermaid.init().catch(() => {});
    });
  }
});
