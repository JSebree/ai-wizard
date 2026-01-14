import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        // Enable PWA in dev to test install flow
        devOptions: { enabled: true },
        includeAssets: ["apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "SceneMe Studios",
          short_name: "SceneMe",
          description: "AI Video Generation Studio",
          theme_color: "#000000",
          background_color: "#000000",
          display: "standalone",
          orientation: "portrait",
          categories: ["multimedia", "productivity", "entertainment", "ai"],
          start_url: "/",
          id: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" }
          ],
          screenshots: [
            // Recommendation: Add actual screenshots of the app here for Rich Install UI on Android
            // { src: "/screenshot-mobile.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Mobile View" },
            // { src: "/screenshot-desktop.png", sizes: "1920x1080", type: "image/png", form_factor: "wide", label: "Desktop View" }
          ]
        },
        workbox: {
          navigateFallback: "/index.html",
          runtimeCaching: [
            // GUARDRAIL 1: Never cache generated videos or heavy assets
            {
              urlPattern: ({ request, url }) => request.destination === 'video' || url.pathname.includes('/api/generate'),
              handler: 'NetworkOnly',
            },
            // GUARDRAIL 2: NetworkFirst for API to ensure user sees current credits/status
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              },
            },
            // GUARDRAIL 3: Cache UI images (thumbnails) for speed, but allow updates
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images',
                expiration: { maxEntries: 60, maxAgeSeconds: 86400 }, // 1 day
              },
            },
          ],
        },
      })
    ],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/webhook': {
          target: 'https://n8n.simplifies.click',
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/video-proxy': {
          target: 'https://nyc3.digitaloceanspaces.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/video-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            });
          }
        },
        '/media-proxy': {
          target: 'https://media-catalog.nyc3.digitaloceanspaces.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/media-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            });
          }
        },
        '/generations-proxy': {
          target: 'https://video-generations.nyc3.digitaloceanspaces.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/generations-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            });
          }
        },
        '/voice-proxy': {
          target: 'https://voice-generations.nyc3.digitaloceanspaces.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/voice-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            });
          }
        },
        '/last-frames-proxy': {
          target: 'https://a-roll-output.nyc3.digitaloceanspaces.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/last-frames-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            });
          }
        },
        '/seed-vc-proxy': {
          target: 'https://api.runpod.ai/v2/f9kykzikds5kc0',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/seed-vc-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Inject the key locally for dev using loaded env
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_RUNPOD_API_KEY || env.RUNPOD_API_KEY}`);
            });
          }
        },
        '/infcam-proxy': {
          target: 'https://api.runpod.ai/v2/qd2x3p5z8axsf2',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/infcam-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Inject the key locally for dev using loaded env
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_RUNPOD_API_KEY || env.RUNPOD_API_KEY}`);
            });
          }
        },
        '/foley-proxy': {
          target: 'https://api.runpod.ai/v2/hpwhz8gov7ko7m',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/foley-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Inject the key locally for dev using loaded env
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_RUNPOD_API_KEY || env.RUNPOD_API_KEY}`);
            });
          }
        },
      },
    },
  }
})
