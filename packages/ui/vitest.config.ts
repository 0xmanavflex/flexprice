import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { fileURLToPath } from 'node:url'

// `@fp/ui` resolves its own internals through `@ui/`; see components.json.
const alias = { '@ui/': fileURLToPath(new URL('./src/', import.meta.url)) }

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        // Every story runs as a test in a real browser, with the accessibility
        // checks from `.storybook/preview.ts` applied as failures.
        plugins: [react(), tailwindcss(), storybookTest({ configDir: '.storybook' })],
        resolve: { alias },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
