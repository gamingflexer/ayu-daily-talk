import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import App from './App.jsx';

// Keep Chrome's install event for our own "Add to Home screen" banner.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__ayuInstallEvent = e;
  window.dispatchEvent(new Event('ayu-install-ready'));
});

registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
