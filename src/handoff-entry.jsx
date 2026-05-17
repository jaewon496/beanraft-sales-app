/* handoff-entry.jsx — 검증용 단독 진입점.
   App.jsx / main.jsx 를 건드리지 않고 HandoffPreview 만 렌더한다.
   Vite 개발 서버에서 /handoff-test.html 로 열면 보인다. */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/handoff/colors_and_type.css';
import './styles/handoff/sales.css';
import './styles/handoff/matte.css';
import HandoffPreview from './components/handoff/HandoffPreview.jsx';

const root = document.getElementById('handoff-root');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <div className="bc-app">
      <HandoffPreview />
    </div>
  </React.StrictMode>
);
