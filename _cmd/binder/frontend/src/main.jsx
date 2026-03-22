import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/theme.css'
import './assets/style.css'
import App from './app/App'
import HistoryApp from './app/HistoryApp'
import PreviewApp from './app/PreviewApp'
import SyslogApp from './app/SyslogApp'

import { GetTheme } from '../bindings/binder/api/app'

const container = document.getElementById('root')
const root = createRoot(container)

const params = new URLSearchParams(window.location.search);
const isCommitWindow  = params.get('commit')  === '1';
const isHistoryWindow = params.get('history') === '1';
const isPreviewWindow = params.get('preview') === '1';
const isSyslogWindow  = params.get('syslog')  === '1';

// 設定からテーマを適用（全ウィンドウ共通）
// theme が未設定 or "dark" → ダーク（デフォルト）、"light" → ライト
GetTheme().then((t) => {
  document.documentElement.setAttribute('data-theme', t);
}).catch(() => {});

root.render(
    <React.StrictMode>
      <HashRouter>
        {isSyslogWindow ? <SyslogApp /> : isPreviewWindow ? <PreviewApp /> : isHistoryWindow ? <HistoryApp /> : <App />}
      </HashRouter>
    </React.StrictMode>
)