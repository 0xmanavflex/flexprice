import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      // @fp/ui ships TypeScript source and resolves its own internals through
      // `@ui/`. The alias has to exist here too, because the app is what
      // actually bundles those files.
      '@ui/': fileURLToPath(new URL('../../packages/ui/src/', import.meta.url)),
    },
  },
  server: { port: 3000 },
})
