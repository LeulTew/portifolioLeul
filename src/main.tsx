import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Upright weight axis only: the design uses no italics, so the italic files stay unshipped.
// Subsetted by unicode-range, so an English page fetches just the latin file.
import '@fontsource-variable/inter/wght.css';
import './index.css';
import { ThemeProvider } from './components/sections/theme/ThemeProvider';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
