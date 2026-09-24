import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { architecture } from './architecture.js'

/**
 * Paths whose contents we did not write and must not edit.
 *
 * Vendored from the ReUI registry by the shadcn CLI. The rule is that an
 * upstream fix stays a re-install, so linting them to our standards would only
 * ever produce edits that the next install destroys.
 */
const VENDORED = [
  'packages/ui/src/components/reui/**',
  'packages/ui/src/primitives/**',
  'packages/ui/src/components/blocks/**',
]

export const config = [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.gen.ts', '**/.nx/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    // Registered explicitly rather than through the plugin's own config
    // export, which is still eslintrc-shaped and will not load in flat config.
    // It has to be registered at all — not merely silenced — because vendored
    // files carry inline `eslint-disable react-hooks/*` comments, and an
    // inline disable for an unknown rule is itself an error.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The V1 dashboard forbids `any` in prose and has 73 of them. Here the
      // linter disagrees with you instead of a reviewer.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Build and codegen scripts run in Node, not a browser.
    files: ['**/scripts/**/*.{mjs,js}', '*.config.{ts,js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    /**
     * Vendored code is held to its own standards, not ours.
     *
     * Only the rules it cannot satisfy are lifted — `@ts-nocheck` is there
     * deliberately (see `packages/ui/scripts/vendor-suppress.mjs`), and the
     * hook-dependency and unused-variable findings are the registry's to fix.
     * Everything else still applies, including the architecture boundaries: a
     * vendored file reaching for `@fp/query` would still fail the build.
     */
    files: VENDORED,
    // Turning a rule off makes the registry's own inline disables redundant,
    // and a redundant disable is itself reported. Ours still are — this is
    // scoped to vendored paths only.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-useless-assignment': 'off',
    },
  },
  ...architecture,
]

export default config
