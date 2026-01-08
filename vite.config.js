import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.webp'],
      manifest: {
        name: '빈크래프트 영업관리',
        short_name: '빈크래프트',
        description: '빈크래프트 영업관리 시스템',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*firebaseio\.com/,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache' }
          },
          {
            urlPattern: /^https:\/\/.*googleapis\.com/,
            handler: 'NetworkFirst',
            options: { cacheName: 'google-api-cache' }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
});
