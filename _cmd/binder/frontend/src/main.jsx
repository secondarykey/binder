import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/style.css'
import App from './app/App'
import HistoryApp from './app/HistoryApp'
import PreviewApp from './app/PreviewApp'
import SyslogApp from './app/SyslogApp'

import { GetTheme, GetLanguage } from '../bindings/binder/api/app'
import { applyTheme } from './theme'
import { loadLanguage } from './i18n/config'

const container = document.getElementById('root')
const root = createRoot(container)

const params = new URLSearchParams(window.location.search);
const isCommitWindow  = params.get('commit')  === '1';
const isHistoryWindow = params.get('history') === '1';
const isPreviewWindow = params.get('preview') === '1';
const isSyslogWindow  = params.get('syslog')  === '1';

// テーマと言語を動的に読み込んでからレンダリング
Promise.all([
  GetTheme().then(t => applyTheme(t || 'dark')).catch(() => applyTheme('dark')),
  GetLanguage().then(l => loadLanguage(l || 'en')).catch(() => loadLanguage('en')),
]).then(() => {
  root.render(
      <React.StrictMode>
        <HashRouter>
          {isSyslogWindow ? <SyslogApp /> : isPreviewWindow ? <PreviewApp /> : isHistoryWindow ? <HistoryApp /> : <App />}
        </HashRouter>
      </React.StrictMode>
  )
});
