import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // o three.js sozinho passa de 500 kB; ele já vem num pedaço à parte, baixado junto com o app
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // bibliotecas em pedaços próprios: um deploy que só muda o app não obriga a baixar React, Supabase e three.js de novo
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/')) return 'three'
          if (id.includes('/@supabase/')) return 'supabase'
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
