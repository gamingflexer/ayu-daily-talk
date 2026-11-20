import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PAGES_BASE=/ayu-daily-talk/ for GitHub Pages; "/" everywhere else.
const base = process.env.PAGES_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg', 'robots.txt', 'sitemap.xml'],
      manifest: {
        id: base,
        name: 'Ayu — daily health check',
        short_name: 'Ayu',
        description: 'A daily health check for pregnant women and new mothers, in her language.',
        lang: 'en',
        start_url: `${base}#/`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEEAE5',
        theme_color: '#EEEAE5',
        categories: ['health', 'medical'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Today’s check', short_name: 'Check', url: `${base}#/check`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Help now', short_name: 'Help', url: `${base}#/help`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Offline shell: the app, the daily check and its rules (bundled in JS), fonts and icons.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'],
        // The Gemini SDK chunk is only needed for live talks — don't make every phone download it.
        globIgnores: ['**/gemini-live-*.js', '**/og-image.png'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // A new build takes over open pages straight away, so old pages don't ask for removed chunks.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
