import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/theme.css'
import './assets/style.css'
import App from './app/App'
import CommitApp from './app/CommitApp'
import HistoryApp from './app/HistoryApp'

import { GetSetting } from '../bindings/binder/api/app'

const container = document.getElementById('root')
const root = createRoot(container)

const params = new URLSearchParams(window.location.search);
const isCommitWindow  = params.get('commit')  === '1';
const isHistoryWindow = params.get('history') === '1';

// 設定からテーマを適用（全ウィンドウ共通）
// theme が未設定 or "dark" → ダーク（デフォルト）、"light" → ライト
GetSetting().then((s) => {
  const theme = s?.lookAndFeel?.theme;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}).catch(() => {});

root.render(
    <React.StrictMode>
      <HashRouter>
        {isHistoryWindow ? <HistoryApp /> : isCommitWindow ? <CommitApp /> : <App />}
      </HashRouter>
    </React.StrictMode>
)