/// <reference types="vite/client" />

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryProvider } from './state/queryClient';
import App from './App.tsx';
import './styles/index.css';

// Create root element and render the app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Please ensure your HTML includes a div with id="root"');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>
);