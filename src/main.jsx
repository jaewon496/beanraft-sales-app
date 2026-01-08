import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 로딩 화면 제거 함수
const hideLoading = () => {
  const loading = document.getElementById('initial-loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 300);
  }
};

// React 앱 렌더링
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <App />
);

// 앱 로드 완료 시 로딩 화면 제거
setTimeout(hideLoading, 100);
