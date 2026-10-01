import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'

/**
 * The workbench chrome, in the same teal-on-warm-neutral as the console.
 *
 * Storybook's default theme is its own pink. Leaving that on makes the
 * workbench look like a different product from the stories inside it.
 */
addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Flexprice',
    brandTarget: '_self',

    colorPrimary: '#07383e',
    colorSecondary: '#0f766e',

    appBg: '#f6f5f2',
    appContentBg: '#ffffff',
    appPreviewBg: '#fdfcfb',
    appBorderColor: 'rgba(48, 46, 42, 0.12)',
    appBorderRadius: 8,

    fontBase: 'ui-sans-serif, system-ui, sans-serif',
    fontCode: 'ui-monospace, SFMono-Regular, Menlo, monospace',

    textColor: '#3f3c38',
    textInverseColor: '#ffffff',
    textMutedColor: '#6f6b66',

    barTextColor: '#6f6b66',
    barSelectedColor: '#07383e',
    barBg: '#ffffff',

    inputBg: '#ffffff',
    inputBorder: 'rgba(48, 46, 42, 0.16)',
    inputTextColor: '#3f3c38',
    inputBorderRadius: 8,
  }),
})
