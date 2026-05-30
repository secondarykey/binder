import React from 'react'
import { createRoot } from 'react-dom/client'

import './assets/style.css'
import App from './App'

import { GetTheme, GetLanguage } from '../bindings/binder/lite/app'
import { initTheme } from './theme'
import { loadLanguage } from './language'

const container = document.getElementById('root')
const root = createRoot(container)

// テーマと言語を動的に読み込んでからレンダリング
Promise.all([
  GetTheme().then(t => initTheme(t)).catch(() => initTheme('system')),
  GetLanguage().then(l => loadLanguage(l || 'en')).catch(() => loadLanguage('en')),
]).then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
});
