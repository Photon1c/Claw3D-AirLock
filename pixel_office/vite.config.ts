import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4173',
        changeOrigin: true,
      },
      '/command': {
        target: 'http://localhost:4173',
        changeOrigin: true,
      },
      '/handoff': {
        target: 'http://localhost:4173',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Access-Control-Allow-Origin', '*');
          });
        },
      },
    },
    fs: {
      allow: [
        path.resolve(__dirname, '..'),
      ],
    },
  },
  publicDir: path.resolve(__dirname, '../.handoff'),
})
