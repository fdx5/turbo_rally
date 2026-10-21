import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/** Dev only: serve /api/* from the same Vercel function files (local libSQL file DB if no TURSO_*). */
function apiDev(): Plugin {
  let server: ViteDevServer;
  return {
    name: 'turbo-rally-api-dev',
    configureServer(s) {
      server = s;
      s.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const path = req.url.slice(5).split('?')[0].replace(/\/$/, '');
        const file = resolve(import.meta.dirname, 'api', `${path}.ts`);
        if (path.startsWith('_') || !existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end('{"error":"not found"}');
        }
        try {
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end('{"error":"dev api error"}');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [
      react(),
      apiDev(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'TURBO RALLY',
          short_name: 'TURBO RALLY',
          description: '귀염뽀짝 파스텔 3D 카트 레이싱',
          theme_color: '#ff5c93',
          background_color: '#ffe9f2',
          display: 'fullscreen',
          orientation: 'landscape',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//, /^\/dev\//],
          runtimeCaching: [
            { urlPattern: /\/audio\/.*\.(mp3|ogg)$/, handler: 'CacheFirst', options: { cacheName: 'voices', expiration: { maxEntries: 400 } } },
            { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 30 } } },
          ],
        },
      }),
    ],
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          audioReview: resolve(import.meta.dirname, 'dev/audio-review.html'),
          turntable: resolve(import.meta.dirname, 'dev/turntable.html'),
          race: resolve(import.meta.dirname, 'dev/race.html'),
        },
        output: {
          manualChunks: (id: string) => (id.includes('node_modules/three') || id.includes('postprocessing') ? 'three' : id.includes('node_modules/react') || id.includes('scheduler') ? 'react' : undefined),
        },
      },
    },
    server: { port: 5173, host: true },
  };
});
