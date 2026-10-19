import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The aliases mirror `vite.config.ts`.
 *
 * Without them a module that imports through `@/` cannot be tested at all —
 * the run fails to resolve the package rather than failing an assertion, so
 * the gap looks like "this has no tests" rather than "this cannot be tested".
 * That is why `completeAccount`, which reads `@/env`, had none.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      '@ui/': fileURLToPath(new URL('../../packages/ui/src/', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
