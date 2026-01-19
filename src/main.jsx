import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 로딩 화면 숨기기
const hideLoading = () => {
  const loading = document.getElementById('initial-loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 300);
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 앱 로드 완료 후 로딩 화면 숨김
hideLoading();
