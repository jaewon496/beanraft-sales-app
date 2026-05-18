import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// ── handoff-matte/override.css 제거 (시안 100% 적용을 위해 매트 덮어쓰기 차단)
// 시안 원본 colors_and_type.css + sales.css 는 UnifiedLayout.jsx 에서 import

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
