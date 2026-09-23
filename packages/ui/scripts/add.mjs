/**
 * Installs a ReUI item, then re-applies the vendor suppression.
 *
 * Two steps that must not come apart: `shadcn add` writes files that do not
 * compile under this repo's strictness, and forgetting the second step makes
 * the build fail in code nobody wrote. One command so nobody has to remember.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const items = process.argv.slice(2)

if (items.length === 0) {
  console.error('usage: pnpm ui:add @reui/data-grid [more...]')
  process.exit(1)
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', env: process.env })

run('pnpm', ['dlx', 'shadcn@latest', 'add', ...items, '--yes', '--overwrite'])
run('node', [resolve(root, 'scripts/vendor-suppress.mjs')])
