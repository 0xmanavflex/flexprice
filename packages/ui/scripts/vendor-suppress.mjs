/**
 * Marks vendored registry files as not-our-typecheck.
 *
 * The repo's `tsconfig.base.json` is deliberately strict —
 * `exactOptionalPropertyTypes`, `noUnusedLocals`,
 * `noUncheckedIndexedAccess`. ReUI does not ship against those settings, so a
 * freshly installed `data-grid` produces a dozen errors in code we did not
 * write and must not edit: the rule is that an upstream fix stays a
 * re-install, and a hand-patched vendored file silently loses that.
 *
 * The alternatives were worse. Relaxing the flags repo-wide would give up the
 * strictness on *our* code to accommodate someone else's. Hand-fixing each
 * file makes the next `shadcn add` a merge conflict.
 *
 * So: a mechanical, idempotent, re-runnable header. Run it after every
 * install — `pnpm ui:add` does it automatically. Our own components, in
 * `pages/` and `compositions/`, are never touched and stay fully checked.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Vendored, therefore not ours to fix. Everything else is fully typechecked. */
const VENDORED = [
  'src/components/reui/**/*.{ts,tsx}',
  'src/components/primitives/**/*.{ts,tsx}',
  // Premium blocks arrive as whole demo pages with their own components and
  // fixture data. They are a starting point to adapt, not code we maintain —
  // same rule, same treatment.
  'src/components/blocks/**/*.{ts,tsx}',
  /*
   * Registry hooks land here, and every file in `hooks/` comes from the
   * registry — `use-mobile` and `use-file-upload` are both declared
   * `registryDependencies` of the blocks that pulled them in. The directory was
   * missing from this list, so installing `settings-7` dropped an unsuppressed
   * `use-file-upload.ts` that fails `exactOptionalPropertyTypes` and broke
   * typecheck for the whole workspace. If a hand-written hook ever belongs
   * here, move it out or narrow this glob — do not let it be suppressed.
   */
  'src/hooks/**/*.{ts,tsx}',
  // `c-*` examples are the same: vendored reference use-cases we read and adapt,
  // authored against looser settings than our strict tsconfig.
  'src/components/examples/**/*.{ts,tsx}',
]

const MARKER = '// @ts-nocheck'
const HEADER = `${MARKER} — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
`

let changed = 0
let checked = 0

for (const pattern of VENDORED) {
  for (const file of globSync(pattern, { cwd: root })) {
    // index.ts files in these folders are ours — they are the barrels we wrote.
    if (file.endsWith('index.ts')) continue

    const path = resolve(root, file)
    const source = readFileSync(path, 'utf8')
    checked += 1
    if (source.startsWith(MARKER)) continue

    writeFileSync(path, HEADER + source)
    changed += 1
    console.log(`  suppressed ${relative(root, path)}`)
  }
}

console.log(
  changed === 0
    ? `vendored files already suppressed (${checked} checked)`
    : `suppressed ${changed} of ${checked} vendored files`,
)
