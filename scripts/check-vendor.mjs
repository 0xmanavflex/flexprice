#!/usr/bin/env node
// Fails when a vendored UI file differs from the committed baseline.
// Vendored code is copied from the ReUI / shadcn registries; a hand edit
// silently forks it. Re-install from the registry, or update the baseline in
// a PR that says why:  node scripts/check-vendor.mjs --update
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const lockPath = join(root, 'packages/ui/vendor.lock.json')
const dirs = [
  ...['primitives', 'reui', 'blocks', 'examples', 'ui'].map((d) =>
    join(root, 'packages/ui/src/components', d),
  ),
  // ReUI Motion Icons, installed by packages/ui/scripts/icons-sync.mjs.
  join(root, 'packages/ui/src/reui'),
]

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(tsx?|css|svg)$/.test(name) && !/\.(stories|test)\./.test(name) ? [full] : []
  })
}

function snapshot() {
  const out = {}
  for (const file of dirs.flatMap(walk).sort()) {
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    out[relative(root, file)] = createHash('sha256').update(text).digest('hex').slice(0, 16)
  }
  return out
}

const current = snapshot()

if (process.argv.includes('--update')) {
  writeFileSync(lockPath, JSON.stringify(current, null, 2) + '\n')
  console.log(`vendor baseline updated: ${Object.keys(current).length} files`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(lockPath, 'utf8'))
} catch {
  console.error(
    'packages/ui/vendor.lock.json is missing. Run: node scripts/check-vendor.mjs --update',
  )
  process.exit(1)
}

const changed = Object.keys(current).filter((f) => f in baseline && baseline[f] !== current[f])
const added = Object.keys(current).filter((f) => !(f in baseline))
const removed = Object.keys(baseline).filter((f) => !(f in current))

if (changed.length + added.length + removed.length === 0) {
  console.log(`vendor check passed: ${Object.keys(current).length} files match the baseline`)
  process.exit(0)
}

for (const [label, list] of [
  ['edited', changed],
  ['added', added],
  ['removed', removed],
]) {
  for (const f of list) console.error(`${label.padEnd(8)} ${f}`)
}
console.error(
  '\nVendored UI files must match the registry. Re-install the item (pnpm ui:add <item>) or, if the\n' +
    'change is intended, run `node scripts/check-vendor.mjs --update` and explain it in the PR.\n' +
    'packages/ui/vendor.lock.json is owned by the design-system reviewer (see .github/CODEOWNERS).',
)
process.exit(1)
