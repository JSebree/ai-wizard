import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
