import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { architecture } from './architecture.js'
import { designRules } from './design.js'

/**
 * Paths whose contents we did not write and must not edit.
 *
 * Vendored from the ReUI registry by the shadcn CLI. The rule is that an
 * upstream fix stays a re-install, so linting them to our standards would only
 * ever produce edits that the next install destroys.
 */
/**
 * Where registry code lands.
 *
 * This list must stay in step with `VENDORED` in
 * `packages/ui/scripts/vendor-suppress.mjs` — that one decides which files get
 * a `@ts-nocheck` header, this one decides which files are allowed to have
 * one. They drifted once: `src/hooks/**` was in neither, so installing a block
 * that pulled in `use-file-upload` broke typecheck, and adding it to only the
 * suppress list then broke lint on the very header that fixed it.
 */
const VENDORED = [
  'packages/ui/src/components/reui/**',
  'packages/ui/src/components/primitives/**',
  'packages/ui/src/components/blocks/**',
  'packages/ui/src/components/examples/**',
  'packages/ui/src/hooks/**',
  // ReUI Motion Icons installed by `pnpm icons:sync`. Each file carries @ts-nocheck.
  'packages/ui/src/reui/**',
]

export const config = [
  // Build output and tool artifacts. `test-results/` and `playwright-report/`
  // hold Playwright traces — minified vendor JS and screenshots that are
  // git-ignored but still on disk, so without this a local e2e run leaves the
  // next `pnpm lint` failing on `no-undef` in code nobody wrote.
  {
    ignores: [
      '**/dist/**',
      // The mocked bundle the CI journeys build (`apps/console/playwright.config.ts`).
      '**/dist-e2e/**',
      '**/node_modules/**',
      '**/*.gen.ts',
      '**/.nx/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/storybook-static/**',
      '**/.agents/**',
    ],
  },
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
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-useless-assignment': 'off',
      /*
       * The ReUI code-block highlighter strips ANSI escapes, so its regex is
       * necessarily full of control characters — `\x1b`, `\x07`. The rule is
       * right in general and wrong here, and the file is the registry's to
       * change, not ours.
       */
      'no-control-regex': 'off',
    },
  },
  ...architecture,
  // The checkable half of docs/design-rules.md.
  ...designRules,
]

export default config
