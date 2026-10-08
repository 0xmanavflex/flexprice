#!/usr/bin/env node
// Generates packages/ui/src/design-system/anatomy.generated.json: for every story file,
// every component of @fp/ui it is built from, and for every console page, the
// kit components it renders. The Storybook "Anatomy" panel and the "Page map"
// docs page read it, so a developer can see "which UI is on this page" without
// opening the source.
//   node scripts/storybook-anatomy.mjs           write
//   node scripts/storybook-anatomy.mjs --check   fail if the file is stale
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const uiRoot = join(root, 'packages/ui')
const uiSrc = join(uiRoot, 'src')
const pagesDir = join(root, 'apps/console/src/pages')
const routerFile = join(root, 'apps/console/src/app/router.tsx')
const out = join(uiRoot, 'src/design-system/anatomy.generated.json')

const toPosix = (p) => p.split('\\').join('/')

function walk(dir, accept) {
  return readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === 'dist') return []
    const f = join(dir, n)
    return statSync(f).isDirectory() ? walk(f, accept) : accept(n) ? [f] : []
  })
}

function layerOf(file) {
  const rel = toPosix(relative(uiSrc, file))
  const vendor = rel.match(/^components\/(primitives|reui|blocks|examples|ui)\//)
  if (vendor) return `vendor/${vendor[1]}`
  if (rel.startsWith('compositions/')) return 'composition'
  if (rel.startsWith('pages/')) return 'surface'
  return 'other'
}

const isSource = (n) => /\.tsx?$/.test(n) && !/\.(stories|test|d)\./.test(n)
const sourceFiles = walk(uiSrc, isSource)
const storyFiles = walk(uiSrc, (n) => /\.stories\.tsx?$/.test(n))
const text = new Map([...sourceFiles, ...storyFiles].map((f) => [f, readFileSync(f, 'utf8')]))

// name -> defining file. A name defined in two places keeps the product copy
// over a vendored one, because the product component is the one pages mean.
const owner = new Map()
const rank = (f) => (layerOf(f).startsWith('vendor') ? 1 : 0)
for (const f of sourceFiles)
  for (const m of text
    .get(f)
    .matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g)) {
    if (/Provenance$/.test(m[1])) continue
    const prev = owner.get(m[1])
    if (!prev || rank(f) < rank(prev)) owner.set(m[1], f)
  }
// `export { A, B } from './x'` re-exports do not define anything; ignore them.

function importedNames(src) {
  const names = new Set()
  for (const m of src.matchAll(/import\s+(?!type\b)([^'"]*?)\s+from\s+'[^']+'/g)) {
    const braces = m[1].match(/\{([^}]*)\}/s)
    if (!braces) continue
    for (const part of braces[1].split(',')) {
      const t = part.trim()
      if (!t || t.startsWith('type ')) continue
      const n = t.split(/\s+as\s+/)[0]
      if (/^[A-Z]/.test(n)) names.add(n)
    }
  }
  return names
}

// Names that read as components: defined here, PascalCase, and used as JSX or
// handed around as a value. Hooks and constants are dropped by case and shape.
function isComponentName(name) {
  const file = owner.get(name)
  if (!file) return false
  if (/^[A-Z0-9_]+$/.test(name)) return false
  return new RegExp(`(?:function|const|class)\\s+${name}\\b`).test(text.get(file))
}

const components = {}
for (const [name, file] of owner) {
  if (!isComponentName(name)) continue
  const direct = [...importedNames(text.get(file))].filter((n) => n !== name && isComponentName(n))
  components[name] = {
    file: toPosix(relative(uiRoot, file)),
    layer: layerOf(file),
    composes: direct.sort(),
    usedBy: [],
    story: null,
  }
}
// Components defined in the same file share its imports; that is the honest
// grain of "what does this file use".

const stories = {}
for (const f of storyFiles) {
  const src = text.get(f)
  const title = src.match(/title:\s*'([^']+)'/)?.[1] ?? null
  const importPath = `./${toPosix(relative(uiRoot, f))}`
  const uses = [...importedNames(src)].filter((n) => isComponentName(n)).sort()
  const own = src.match(/component:\s*([A-Z][A-Za-z0-9]*)/)?.[1] ?? null
  stories[importPath] = { title, component: own && components[own] ? own : null, uses }
  // A story belongs to the components defined in the file it sits beside.
  const sibling = f.replace(/\.stories\.tsx?$/, '')
  for (const [name, c] of Object.entries(components))
    if (join(uiRoot, c.file).replace(/\.tsx?$/, '') === sibling && !c.story) c.story = importPath
  if (own && components[own] && !components[own].story) components[own].story = importPath
}

for (const [name, c] of Object.entries(components))
  for (const used of c.composes) if (components[used]) components[used].usedBy.push(name)
for (const c of Object.values(components)) c.usedBy.sort()

// Console pages: which kit components they name, and which URL they serve.
const routeOf = new Map()
if (existsSync(routerFile)) {
  const router = readFileSync(routerFile, 'utf8')
  for (const m of router.matchAll(/createRoute\(\{([\s\S]*?)\n\}\)/g)) {
    const path = m[1].match(/path:\s*'([^']+)'/)?.[1]
    const comp = m[1].match(/component:\s*([A-Za-z0-9]+)/)?.[1]
    if (!path || !comp) continue
    const body = router.match(new RegExp(`function ${comp}\\b[\\s\\S]*?\\n\\}\\n`))?.[0] ?? ''
    for (const p of body.matchAll(/<([A-Z][A-Za-z0-9]*Page)\b/g)) routeOf.set(p[1], path)
  }
}

function pattern(name) {
  if (/ListPage|GridPage|IndexPage/.test(name)) return 'List'
  if (/DetailPage|Detail/.test(name)) return 'Detail'
  if (/FormPage|CreatePage|NewPage|EditPage/.test(name)) return 'Form'
  if (/Settings/.test(name)) return 'Settings'
  if (/Home|Revenue|Dashboard/.test(name)) return 'Dashboard'
  return 'Other'
}

const pages = {}
for (const f of walk(pagesDir, (n) => /Page\.tsx$/.test(n)).sort()) {
  const src = readFileSync(f, 'utf8')
  const name = f.split('/').pop().replace('.tsx', '')
  const imported = new Set()
  for (const m of src.matchAll(/import\s+(?!type\b)([^'"]*?)\s+from\s+'(@fp\/ui[^']*)'/g)) {
    const braces = m[1].match(/\{([^}]*)\}/s)
    if (!braces) continue
    for (const part of braces[1].split(',')) {
      const t = part.trim()
      if (!t || t.startsWith('type ')) continue
      const n = t.split(/\s+as\s+/)[0]
      if (components[n]) imported.add(n)
    }
  }
  pages[name] = {
    file: toPosix(relative(root, f)),
    pattern: pattern(name),
    route: routeOf.get(name) ?? null,
    uses: [...imported].sort(),
  }
}

const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
const json = `${JSON.stringify({ components: sortKeys(components), stories: sortKeys(stories), pages }, null, 2)}\n`

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : ''
  if (current !== json) {
    console.error('storybook anatomy is stale — run: node scripts/storybook-anatomy.mjs')
    process.exit(1)
  }
  console.log('storybook anatomy is current')
} else {
  writeFileSync(out, json)
  console.log(
    `anatomy: ${Object.keys(components).length} components, ${Object.keys(stories).length} stories, ${Object.keys(pages).length} pages`,
  )
}
