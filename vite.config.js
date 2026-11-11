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
        name: 'Ayu — daily 5-minute talk',
        short_name: 'Ayu',
        description: 'A 5-minute daily health talk for pregnant women and new mothers. Demo with mock data.',
        lang: 'en',
        start_url: `${base}#/today`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF7F5',
        theme_color: '#FAF7F5',
        categories: ['health', 'medical'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Start today’s talk', short_name: 'Talk', url: `${base}#/talk`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Share with doctor', short_name: 'Share', url: `${base}#/share`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Offline shell: the app, its mock data (bundled in JS), fonts and icons.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // The Gemini SDK chunk is only needed for live talks — don't make every phone download it.
        globIgnores: ['**/gemini-live-*.js', '**/og-image.png'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
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
