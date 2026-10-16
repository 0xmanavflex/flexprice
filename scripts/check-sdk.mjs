#!/usr/bin/env node
/**
 * SDK contract check: is the console in step with `@flexprice/sdk`, and is the
 * SDK in step with the backend it is generated from?
 *
 *   node scripts/check-sdk.mjs                 report (offline: SDK vs console)
 *   node scripts/check-sdk.mjs --remote        also compare to npm and the backend spec
 *   node scripts/check-sdk.mjs --check         exit 1 on a new problem (offline)
 *   node scripts/check-sdk.mjs --remote --check   what the weekly watch runs
 *   node scripts/check-sdk.mjs --write-baseline   accept today's known gaps
 *   node scripts/check-sdk.mjs --json          machine-readable report
 *
 * Offline checks (run on every PR; fail with --check):
 *   1. every `client.<namespace>.<method>(` the console makes exists in the installed SDK;
 *   2. `as never` casts on SDK calls only go down — each one turns off the
 *      request-type check, which is how a renamed field slips through;
 * Remote checks (weekly watch; fail with --remote --check):
 *   3. a newer `@flexprice/sdk` is published than the one installed;
 *   4. the backend spec has operations or fields the installed SDK lacks, beyond
 *      the known gaps recorded in scripts/sdk-baseline.json.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'scripts/sdk-baseline.json')
const SPEC_REPO = 'flexprice/flexprice'
const SPEC_PATH = 'docs/swagger/swagger-3-0.json'

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const specArg = args.includes('--spec') ? args[args.indexOf('--spec') + 1] : null

const read = (path) => readFileSync(path, 'utf8')
const kebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
const camel = (snake) => snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const sorted = (iterable) => [...iterable].sort()

function walk(dir, accept, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, accept, out)
    else if (accept(full)) out.push(full)
  }
  return out
}

/* ── The installed SDK ───────────────────────────────────────────────────── */

const sdkDir = ['packages/query', 'packages/api']
  .map((p) => join(ROOT, p, 'node_modules/@flexprice/sdk'))
  .find((p) => existsSync(join(p, 'package.json')))
if (!sdkDir) {
  console.error('check-sdk: @flexprice/sdk is not installed. Run `pnpm install` first.')
  process.exit(2)
}
const installed = JSON.parse(read(join(sdkDir, 'package.json'))).version

/** operationID -> { method, path } from the generated function files. */
const sdkOps = new Map()
for (const file of walk(join(sdkDir, 'src/funcs'), (f) => f.endsWith('.ts'))) {
  const text = read(file)
  const id = text.match(/operationID:\s*"([^"]+)"/)?.[1]
  const path = text.match(/pathToFunc\("([^"]+)"\)/)?.[1]
  const method = text.match(/\bmethod:\s*"([A-Z]+)"/)?.[1]
  if (id && path && method) sdkOps.set(id, { method, path })
}

/** namespace -> Set(method) as the client exposes them (`client.subscriptions.x`). */
const sdkSurface = new Map()
{
  const sdkText = read(join(sdkDir, 'src/sdk/sdk.ts'))
  const classFile = new Map()
  for (const m of sdkText.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*"\.\/([\w-]+)\.js"/g))
    classFile.set(m[1], m[2])
  for (const m of sdkText.matchAll(/get\s+(\w+)\(\):\s*(\w+)\s*\{/g)) {
    const file = classFile.get(m[2])
    if (!file) continue
    const methods = new Set()
    for (const fn of read(join(sdkDir, 'src/sdk', `${file}.ts`)).matchAll(
      /^\s{2}async\s+(\w+)\(/gm,
    ))
      methods.add(fn[1])
    sdkSurface.set(m[1], methods)
  }
}

/* ── What the console calls ──────────────────────────────────────────────── */

const SOURCE_DIRS = [
  'packages/query/src',
  'packages/api/src',
  'packages/actions/src',
  'apps/console/src',
]
const isSource = (f) => /\.(ts|tsx)$/.test(f) && !/\.(test|stories)\.(ts|tsx)$/.test(f)
const sources = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d), isSource))

const used = new Map() // 'ns.method' -> files[]
const unknown = [] // { call, file, line }
let castCount = 0
const castFiles = new Map()
for (const file of sources) {
  const text = read(file)
  const rel = relative(ROOT, file)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\bclient\.(\w+)\.(\w+)\(/g)) {
      const [, ns, method] = m
      if (!sdkSurface.has(ns)) continue // not the SDK client (e.g. a different `client`)
      const key = `${ns}.${method}`
      used.set(key, [...(used.get(key) ?? []), rel])
      if (!sdkSurface.get(ns).has(method)) unknown.push({ call: key, file: rel, line: i + 1 })
    }
  })
  // `as never` inside a statement that calls the SDK client.
  for (const stmt of text.split(/\n(?=\s{0,8}(?:export |const |function |async |\w+\())/)) {
    if (!/\bclient\.\w+\.\w+\(/.test(stmt)) continue
    const n = (stmt.match(/\bas never\b/g) ?? []).length
    if (n) {
      castCount += n
      castFiles.set(rel, (castFiles.get(rel) ?? 0) + n)
    }
  }
}

const allMethods = sorted([...sdkSurface].flatMap(([ns, ms]) => [...ms].map((m) => `${ns}.${m}`)))
const unused = allMethods.filter((k) => !used.has(k))

/* ── The backend spec (remote) ───────────────────────────────────────────── */

async function loadSpec() {
  if (specArg) return JSON.parse(read(specArg))
  try {
    const raw = execFileSync(
      'gh',
      [
        'api',
        `repos/${SPEC_REPO}/contents/${SPEC_PATH}`,
        '-H',
        'Accept: application/vnd.github.raw',
      ],
      { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString()
    return JSON.parse(raw)
  } catch {
    const res = await fetch(`https://raw.githubusercontent.com/${SPEC_REPO}/main/${SPEC_PATH}`)
    if (!res.ok) throw new Error(`could not fetch the backend spec (${res.status})`)
    return res.json()
  }
}

function latestPublished() {
  try {
    return execFileSync('npm', ['view', '@flexprice/sdk', 'version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

/**
 * Property names of `export type <Name> = { ... }` in a generated model file.
 *
 * Speakeasy names a model by its bare name, and by `<package>-<name>` when two
 * packages share one (`price.Price` is `price-price.ts`), so a qualified schema
 * name is tried both ways — unless the bare name is shared, where only the
 * qualified file can be the right one.
 */
function sdkModelProps(schemaName, bareCount) {
  const [pkg, bare = pkg] = schemaName.includes('.') ? schemaName.split('.') : [null, schemaName]
  const candidates = pkg ? [`${pkg}-${bare}`, ...(bareCount.get(bare) > 1 ? [] : [bare])] : [bare]
  for (const candidate of candidates) {
    const file = join(sdkDir, 'src/sdk/models', `${kebab(candidate)}.ts`)
    if (!existsSync(file)) continue
    const text = read(file)
    const qualified = pkg ? pkg[0].toUpperCase() + pkg.slice(1) + bare : bare
    const typeName = [bare, qualified].find((n) =>
      new RegExp(`export type ${n}\\s*=\\s*\\{`).test(text),
    )
    if (!typeName) continue
    const body = text.slice(text.search(new RegExp(`export type ${typeName}\\s*=\\s*\\{`)))
    const open = body.indexOf('{')
    const end = body.search(/^\};/m)
    const props = new Set()
    for (const m of body.slice(open, end < 0 ? undefined : end).matchAll(/^ {2}(\w+)\??:/gm))
      props.add(m[1])
    return props
  }
  return null
}

/** Schemas reachable from the operations the console actually calls. */
function relevantSchemas(spec) {
  const byId = new Map()
  for (const [path, item] of Object.entries(spec.paths))
    for (const [method, op] of Object.entries(item))
      if (op?.operationId) byId.set(op.operationId, op)
  const seen = new Set()
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.$ref === 'string') {
      const name = node.$ref.split('/').pop()
      if (seen.has(name)) return
      seen.add(name)
      visit(spec.components.schemas[name])
      return
    }
    for (const value of Object.values(node)) visit(value)
  }
  for (const key of used.keys()) {
    const op = byId.get(key.split('.')[1])
    if (!op) continue
    visit(op.requestBody)
    visit(op.responses)
  }
  return seen
}

async function remoteReport() {
  const report = { latest: latestPublished(), missingOps: [], missingFields: [], unmapped: [] }
  const spec = await loadSpec()
  const specOps = new Map()
  for (const [path, item] of Object.entries(spec.paths))
    for (const [method, op] of Object.entries(item))
      if (op?.operationId) specOps.set(op.operationId, `${method.toUpperCase()} ${path}`)

  const sdkRoutes = new Set([...sdkOps.values()].map((o) => `${o.method} ${o.path}`))
  const specRoutes = new Set(specOps.values())
  for (const [id, where] of specOps)
    if (!sdkOps.has(id) && !sdkRoutes.has(where)) report.missingOps.push(`${id} (${where})`)
  report.removedOps = sorted(
    [...sdkOps]
      .filter(([id, o]) => !specOps.has(id) && !specRoutes.has(`${o.method} ${o.path}`))
      .map(([id]) => id),
  )
  report.missingOps.sort()

  const relevant = relevantSchemas(spec)
  const bareCount = new Map()
  for (const name of Object.keys(spec.components.schemas)) {
    const bare = name.split('.').pop()
    bareCount.set(bare, (bareCount.get(bare) ?? 0) + 1)
  }
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    if (schema.type !== 'object' || !schema.properties) continue
    const props = sdkModelProps(name, bareCount)
    if (!props) {
      if (relevant.has(name)) report.unmapped.push(name)
      continue
    }
    for (const field of Object.keys(schema.properties)) {
      if (!props.has(camel(field)) && !props.has(field))
        report.missingFields.push(
          `${name.split('.').pop()}.${field}${relevant.has(name) ? ' *' : ''}`,
        )
    }
  }
  report.missingFields.sort()
  report.unmapped.sort()
  return report
}

/* ── Baseline and verdict ────────────────────────────────────────────────── */

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(read(BASELINE_PATH))
  : { castCount: Infinity, missingOps: [], missingFields: [] }

const remote = has('--remote') || has('--write-baseline') ? await remoteReport() : null

if (has('--write-baseline')) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        sdkVersion: installed,
        castCount,
        missingOps: remote.missingOps,
        missingFields: remote.missingFields,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`wrote ${relative(ROOT, BASELINE_PATH)} (SDK ${installed})`)
  process.exit(0)
}

const problems = []
for (const u of unknown)
  problems.push(`console calls ${u.call}, which the SDK does not have (${u.file}:${u.line})`)
if (castCount > baseline.castCount)
  problems.push(`\`as never\` casts on SDK calls rose from ${baseline.castCount} to ${castCount}`)
if (remote) {
  if (remote.latest && remote.latest !== installed)
    problems.push(`@flexprice/sdk ${remote.latest} is published; ${installed} is installed`)
  const newOps = remote.missingOps.filter((o) => !baseline.missingOps.includes(o))
  const newFields = remote.missingFields.filter((f) => !baseline.missingFields.includes(f))
  if (newOps.length) problems.push(`backend operations the SDK lacks (new): ${newOps.join(', ')}`)
  if (newFields.length)
    problems.push(
      `backend fields the SDK lacks (new, * = used by the console): ${newFields.join(', ')}`,
    )
}

if (has('--json')) {
  console.log(
    JSON.stringify(
      { installed, used: used.size, unused, unknown, castCount, remote, problems },
      null,
      2,
    ),
  )
} else {
  console.log(
    `@flexprice/sdk ${installed} — ${allMethods.length} operations, ${used.size} used by the console`,
  )
  console.log(`  calls the SDK does not have: ${unknown.length}`)
  console.log(`  \`as never\` casts on SDK calls: ${castCount} (baseline ${baseline.castCount})`)
  if (castFiles.size)
    for (const [f, n] of [...castFiles].sort((a, b) => b[1] - a[1])) console.log(`    ${n}  ${f}`)
  console.log(`  operations the console never calls: ${unused.length}`)
  if (remote) {
    console.log(`  latest on npm: ${remote.latest ?? 'unknown'}`)
    console.log(`  backend operations missing from the SDK: ${remote.missingOps.length}`)
    for (const o of remote.missingOps) console.log(`    ${o}`)
    const removed = remote.removedOps.filter((o) => !o.startsWith('post_/webhook-events/'))
    console.log(
      `  SDK operations the backend spec no longer has: ${removed.length} (+ ${remote.removedOps.length - removed.length} webhook payload entries the SDK adds itself)`,
    )
    for (const o of removed) console.log(`    ${o}`)
    console.log(
      `  backend fields missing from SDK models: ${remote.missingFields.length} (* = used by the console)`,
    )
    for (const f of remote.missingFields.filter((x) => x.endsWith('*'))) console.log(`    ${f}`)
    console.log(`  console-relevant schemas not found in the SDK: ${remote.unmapped.length}`)
    for (const n of remote.unmapped) console.log(`    ${n}`)
  }
  console.log(problems.length ? `\n${problems.length} problem(s):` : '\nin step.')
  for (const p of problems) console.log(`  - ${p}`)
}

if (has('--check') && problems.length) process.exit(1)
