import React from 'react'
import {createRoot} from 'react-dom/client'
import { HashRouter } from "react-router";

import './assets/style.css'
import App from './App'
import CommitApp from './CommitApp'

const container = document.getElementById('root')
const root = createRoot(container)

const isCommitWindow = new URLSearchParams(window.location.search).get('commit') === '1';

root.render(
    <React.StrictMode>
      <HashRouter>
        {isCommitWindow ? <CommitApp /> : <App />}
      </HashRouter>
    </React.StrictMode>
)