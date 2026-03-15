import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/theme.css'
import './assets/style.css'
import App from './App'
import CommitApp from './CommitApp'
import HistoryApp from './HistoryApp'

const container = document.getElementById('root')
const root = createRoot(container)

const params = new URLSearchParams(window.location.search);
const isCommitWindow  = params.get('commit')  === '1';
const isHistoryWindow = params.get('history') === '1';

root.render(
    <React.StrictMode>
      <HashRouter>
        {isHistoryWindow ? <HistoryApp /> : isCommitWindow ? <CommitApp /> : <App />}
      </HashRouter>
    </React.StrictMode>
)