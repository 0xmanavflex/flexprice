import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { pxToRem } from './px-to-rem'
import { appVersion } from './app-version'

export default defineConfig({
  plugins: [react(), tailwindcss(), pxToRem(), appVersion()],
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      // @fp/ui ships TypeScript source and resolves its own internals through
      // `@ui/`. The alias has to exist here too, because the app is what
      // actually bundles those files.
      '@ui/': fileURLToPath(new URL('../../packages/ui/src/', import.meta.url)),
      // Vendored ReUI code imports icons from `lucide-react`. Resolve that to
      // the ReUI icon barrel so nothing renders a lucide glyph.
      'lucide-react': fileURLToPath(
        new URL('../../packages/ui/src/icons/index.ts', import.meta.url),
      ),
    },
  },
  server: { port: 3000 },

  build: {
    rollupOptions: {
      output: {
        /**
         * Split the dependencies that never change from the code that does.
         *
         * Without this everything outside a route chunk lands in one ~900 kB
         * file, so shipping a one-line fix re-downloads React and Base UI with
         * it. These three are separate because they version independently and
         * are cached across deploys.
         *
         * MSW is left alone deliberately: it is already its own chunk through
         * the dynamic import, and it is only fetched when mocks are switched
         * on — so it costs a production visitor nothing despite its size.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]react(-dom)?[\\/]/.test(id) || id.includes('react/jsx-runtime')) {
            return 'vendor-react'
          }
          if (id.includes('@base-ui')) return 'vendor-base-ui'
          if (id.includes('@tanstack')) return 'vendor-tanstack'
          return undefined
        },
      },
    },
  },
})
