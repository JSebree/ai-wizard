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
      },
      '/media-proxy': {
        target: 'https://media-catalog.nyc3.digitaloceanspaces.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/media-proxy/, ''),
      },
      '/generations-proxy': {
        target: 'https://video-generations.nyc3.digitaloceanspaces.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/generations-proxy/, ''),
      },
    },
  },
})
