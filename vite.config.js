import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

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
