import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      // @fp/ui ships TypeScript source and resolves its own internals through `@ui/`.
      '@ui/': fileURLToPath(new URL('../../packages/ui/src/', import.meta.url)),
      // Vendored ReUI code imports icons from `lucide-react`; resolve that to the ReUI icon barrel.
      'lucide-react': fileURLToPath(new URL('../../packages/ui/src/icons/index.ts', import.meta.url)),
    },
  },
  server: { port: 3002 },
})
