import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Proxy: feed RSS do YouTube sem CORS no navegador (fallback quando a Data API falha por cota). */
const ytRssProxy = {
  '/yt-rss-proxy': {
    target: 'https://www.youtube.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/yt-rss-proxy/, ''),
    secure: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    host: true,
    proxy: ytRssProxy,
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: ytRssProxy,
  },
})
