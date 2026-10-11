import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { mergeConfig } from 'vite'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  core: {
    disableWhatsNewNotifications: true,
  },
  features: {
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
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
   * The workbench has to build CSS the same way the app and the story tests do.
   *
   * `@tailwindcss/vite` lived only in `vitest.config.ts` and `apps/console`.
   * `pnpm storybook` then served the stylesheet as raw CSS: `@theme`, `@apply`
   * and the utility classes never expanded, so every story looked unstyled.
   * The alias has the same history — it lived only in the test config, so the
   * tests passed while the workbench failed to resolve `@ui/*`.
   */
  viteFinal: (config) =>
    mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@ui/': fileURLToPath(new URL('../src/', import.meta.url)),
          // Vendored ReUI code imports `lucide-react`; it gets the ReUI icon barrel.
          'lucide-react': fileURLToPath(new URL('../src/icons/index.ts', import.meta.url)),
        },
      },
    }),
}

export default config
