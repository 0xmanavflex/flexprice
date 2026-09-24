/**
 * Captures real API responses into scrubbed fixtures.
 *
 * Why an API key and not the dashboard login: `validateAPIKey` returns an
 * `environmentID`, and database-backed keys carry their own environment — so
 * this needs neither `POST /auth/login` nor `GET /environments`, both of which
 * are unannotated and therefore absent from the SDK. It runs today, against a
 * backend with no changes.
 *
 * It is a Node script, never browser code. An API key in a `VITE_` variable is
 * compiled into the bundle and served to every visitor.
 *
 * Only documented endpoints are called. If an entity is missing below, it is
 * because its handler carries no swagger annotation — see
 * `docs/api-contract-gap.md`. Nothing here works around that.
 *
 *   FLEXPRICE_API_KEY=… node scripts/capture.mjs
 *   FLEXPRICE_API_KEY=… node scripts/capture.mjs --only customers,invoices
 *   FLEXPRICE_API_KEY=… node scripts/capture.mjs --raw   # skip scrubbing (never commit)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrub } from './scrub.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'src/__fixtures__')

const BASE_URL = process.env.FLEXPRICE_API_URL ?? 'https://api-dev.cloud.flexprice.io/v1'
const API_KEY = process.env.FLEXPRICE_API_KEY

const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',')
const raw = args.includes('--raw')

if (!API_KEY) {
  console.error(
    'FLEXPRICE_API_KEY is not set.\n' +
      '  export FLEXPRICE_API_KEY=… && node scripts/capture.mjs\n' +
      'Use a development-environment key. Never a production one, and never in a VITE_ variable.',
  )
  process.exit(1)
}

/**
 * Small limits on purpose.
 *
 * A fixture is read by a person deciding whether a screen looks right. Five
 * rows of varied shape are more useful than two hundred of the same shape, and
 * they keep the diff reviewable when the capture is re-run.
 */
const LIMIT = 5

/** Every entity reachable through a documented endpoint today. */
const ENTITIES = [
  { key: 'customers', path: '/customers/search', body: { limit: LIMIT } },
  { key: 'plans', path: '/plans/search', body: { limit: LIMIT } },
  { key: 'features', path: '/features/search', body: { limit: LIMIT } },
  { key: 'prices', path: '/prices/search', body: { limit: LIMIT } },
  { key: 'invoices', path: '/invoices/search', body: { limit: LIMIT, skip_line_items: false } },
  { key: 'subscriptions', path: '/subscriptions/search', body: { limit: LIMIT } },
  { key: 'entitlements', path: '/entitlements/search', body: { limit: LIMIT } },
  { key: 'wallets', path: '/wallets/search', body: { limit: LIMIT } },
  { key: 'payments', path: '/payments/search', body: { limit: LIMIT } },
  { key: 'coupons', path: '/coupons/search', body: { limit: LIMIT } },
  { key: 'addons', path: '/addons/search', body: { limit: LIMIT } },
  { key: 'creditnotes', path: '/creditnotes/search', body: { limit: LIMIT } },
  { key: 'creditgrants', path: '/creditgrants/search', body: { limit: LIMIT } },
  { key: 'taxrates', path: '/taxes/rates/search', body: { limit: LIMIT } },
]

async function capture({ key, path, body }) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    return { key, ok: false, status: response.status, detail: text.slice(0, 160) }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { key, ok: false, status: response.status, detail: 'response was not JSON' }
  }

  const items = parsed.items ?? []
  const payload = raw ? parsed : scrub(parsed, key)

  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, `${key}.json`), `${JSON.stringify(payload, null, 2)}\n`)

  return { key, ok: true, count: items.length, total: parsed.pagination?.total ?? null }
}

const targets = only ? ENTITIES.filter((e) => only.includes(e.key)) : ENTITIES
console.log(`capturing ${targets.length} entities from ${BASE_URL}${raw ? '  (RAW — do not commit)' : ''}\n`)

const results = []
for (const entity of targets) {
  results.push(await capture(entity))
}

let captured = 0
for (const r of results) {
  if (r.ok) {
    captured += 1
    console.log(`  ok        ${r.key.padEnd(16)} ${r.count} row(s)${r.total !== null ? ` of ${r.total}` : ''}`)
  } else {
    // A 404 here usually means the endpoint is undocumented rather than absent.
    console.log(`  FAILED    ${r.key.padEnd(16)} HTTP ${r.status}  ${r.detail}`)
  }
}

console.log(`\n${captured}/${results.length} captured into src/__fixtures__/`)
if (raw) console.log('RAW capture — scrubbing was skipped. Do not commit these files.')
process.exit(results.some((r) => !r.ok) ? 1 : 0)
