import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import { HashRouter,Routes,Route } from "react-router-dom";
const container = document.getElementById('root')
const root = createRoot(container)

root.render(
    <React.StrictMode>
    <HashRouter>
<Routes>
    <Route path="/" element={<App/>}/>
</Routes>
    </HashRouter>

    </React.StrictMode>
)
