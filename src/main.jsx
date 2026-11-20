import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import App from './App.jsx';
import { flushResearch } from './research.js';

// Keep Chrome's install event for our own "Add to Home screen" banner.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__ayuInstallEvent = e;
  window.dispatchEvent(new Event('ayu-install-ready'));
});

registerSW({ immediate: true });

// After a deploy, a page served from the old cache asks for code chunks that no longer exist
// (e.g. the Gemini chunk, which is not precached) and the talk stays on "Connecting…".
// Reload once to pick up the new build; the guard stops a reload loop.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const key = 'ayu-reloaded-for-new-build';
    if (sessionStorage.getItem(key) === location.href) return;
    sessionStorage.setItem(key, location.href);
  } catch {
    // no storage: still try once
  }
  e.preventDefault();
  location.reload();
});

// Records that could not be sent last time (no network) go now.
flushResearch();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
