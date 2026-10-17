import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  // Sandboxed preloads must be CommonJS and contain only bundled code.
  preload: {},
  renderer: {
    plugins: [
      react(),
      {
        name: 'development-csp',
        transformIndexHtml: {
          order: 'pre',
          handler(html, context) {
            // React Refresh injects an inline preamble; Vite serves styles and HMR.
            return context.server
              ? html
                  .replace(
                    "script-src 'self'",
                    "script-src 'self' 'unsafe-inline'"
                  )
                  .replace(
                    "style-src 'self'",
                    "style-src 'self' 'unsafe-inline'"
                  )
                  .replace(
                    "connect-src 'self'",
                    "connect-src 'self' ws://127.0.0.1:5173"
                  )
              : html
          }
        }
      }
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    }
  }
})
