import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // A origem liberada no CORS do Core API é exatamente http://localhost:5173.
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
  build: {
    // Nenhum ativo vira data: URI; a CSP do nginx libera só 'self'.
    assetsInlineLimit: 0,
  },
})
