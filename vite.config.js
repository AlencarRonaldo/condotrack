import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'CondoTrack Pro',
        short_name: 'CondoTrack',
        description: 'Sistema de gestão condominial - Segurança, automação e transparência',
        theme_color: '#10b981',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/app.html',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],

  // Otimizações para produção
  build: {
    // Gera sourcemaps para debugging em produção (opcional)
    sourcemap: false,

    // Otimiza o tamanho do bundle
    minify: 'esbuild',

    // Configurações de chunks para melhor caching
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        register: resolve(__dirname, 'register.html'),
        register_success: resolve(__dirname, 'register_success.html'),
        billing: resolve(__dirname, 'billing.html'),
      },
      output: {
        manualChunks: {
          // Separa vendor libs em chunk próprio
          vendor: ['react', 'react-dom'],
          // Separa Supabase em chunk próprio
          supabase: ['@supabase/supabase-js'],
        },
      },
    },

    // Limite de warning para chunks grandes (em kB)
    chunkSizeWarningLimit: 500,
  },

  // Configurações do servidor de desenvolvimento
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },

  // Configurações de preview (build local)
  preview: {
    port: 4173,
    strictPort: false,
  },
})
