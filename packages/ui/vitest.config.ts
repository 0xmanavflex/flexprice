import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { fileURLToPath } from 'node:url'

// `@fp/ui` resolves its own internals through `@ui/`; see components.json.
const alias = {
  '@ui/': fileURLToPath(new URL('./src/', import.meta.url)),
  // Vendored ReUI code imports `lucide-react`; it gets the ReUI icon barrel.
  'lucide-react': fileURLToPath(new URL('./src/icons/index.ts', import.meta.url)),
}

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
        // Shiki is loaded lazily per language, and pdf.js on first use by
        // DocumentViewer, so Vite would only discover them mid-run and reload
        // the browser, failing whatever story was running.
        optimizeDeps: {
          include: [
            'shiki/core',
            'shiki/engine/javascript',
            'shiki/themes/*',
            'shiki/langs/*',
            'pdfjs-dist',
          ],
        },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            /**
             * A desktop viewport, explicitly.
             *
             * The default is narrower than the sidebar's mobile breakpoint, so
             * `useIsMobile` was true and the Sidebar rendered as its closed
             * Sheet — the navigation was simply not in the DOM, and every
             * query for it failed in a way that looked like a selector
             * problem rather than a layout one.
             */
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
