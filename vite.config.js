import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Normally '/' (served from the domain root). Overridable via --base for a
// build hosted under a subpath (e.g. GitHub Pages project sites serve from
// /repo-name/, not /) — see .github/workflows/deploy-pages.yml, used only
// for temporary device testing, not the app's real deployment target.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Contract Whist Scorer',
        short_name: 'Whist',
        description: 'Score contract whist sessions offline.',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        // Spec: tablet is the primary device, but allow rotation (1.3.4).
        orientation: 'any',
        // Must stay within `scope` (which vite-plugin-pwa derives from
        // `base`) or Chrome refuses to treat the manifest as installable.
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell — it must open with no network at all.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
});
