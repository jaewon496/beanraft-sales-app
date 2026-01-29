import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react'
    })
  ],
  build: {
    outDir: 'dist',
    sourceMap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  esbuild: {
    jsxInject: `import React from 'react'`
  }
})
