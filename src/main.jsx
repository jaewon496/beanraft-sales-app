import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// ── 시안 CSS 3종 제거됨 (롤백): colors_and_type.css / sales.css / matte.css
// ── 매트 블랙 톤만 빈크래프트 카드에 강제 적용
import './styles/handoff-matte/override.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
