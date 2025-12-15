import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Safety: Disable PWA logic during local dev to prevent caching confusion
      devOptions: { enabled: false },
      includeAssets: ["apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "SceneMe Studios",
        short_name: "SceneMe",
        description: "AI Video Generation Studio",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }
        ],
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
    proxy: {
      '/webhook': {
        target: 'https://n8n.simplifies.click',
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
    },
  },
})
