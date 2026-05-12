import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { anthropicProxy } from './src/server/anthropic-proxy'

// Cross-origin isolation headers are required for SharedArrayBuffer,
// which the multi-threaded Stockfish build needs (spec section 11).
const crossOriginHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export default defineConfig({
  plugins: [react(), tailwindcss(), anthropicProxy()],
  server: { headers: crossOriginHeaders },
  preview: { headers: crossOriginHeaders },
})
