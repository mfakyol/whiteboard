import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, proxy API + Socket.io to the backend on :5000. In production the app
// is same-origin (the client nginx proxies /api and /socket.io to the server).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` → src. Keep in sync with tsconfig.app.json "paths".
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
})
