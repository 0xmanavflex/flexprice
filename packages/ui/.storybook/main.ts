import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    // Every story becomes a test in a real browser, and an accessibility check.
    // One file, three artifacts — which is what stops the design system, the
    // tests and the documentation from drifting apart.
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
  ],
  framework: { name: '@storybook/react-vite', options: {} },
}

export default config
