import React from 'react';
import ReactDOM from 'react-dom/client';
import ClientPreview from './components/client-mode/ClientPreview';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClientPreview />
  </React.StrictMode>
);
