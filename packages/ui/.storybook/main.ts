import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    // Every story becomes a test in a real browser, and an accessibility check.
    // One file, three artifacts — which is what stops the design system, the
    // tests and the documentation from drifting apart.
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
  ],
  framework: { name: '@storybook/react-vite', options: {} },

  /**
   * `@ui/*` has to resolve here too.
   *
   * The alias lived only in `vitest.config.ts`, so the story *tests* passed
   * while `pnpm storybook` — the workbench a developer actually opens — failed
   * to resolve every import. The tests passing is exactly what hid it.
   */
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@ui/': fileURLToPath(new URL('../src/', import.meta.url)),
      },
    },
  }),
}

export default config
