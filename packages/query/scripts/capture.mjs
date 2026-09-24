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

/**
 * Read `packages/query/.env.local` if it exists.
 *
 * `process.loadEnvFile` is built into Node 22+, so this keeps the repo free of
 * a dotenv dependency — the same approach flexprice-front's e2e suite takes.
 * An already-exported variable still wins, which is what CI wants.
 */
try {
  process.loadEnvFile(resolve(root, '.env.local'))
} catch {
  // Absent or unreadable. The environment is expected to carry the value.
}
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

/**
 * Every entity reachable through a *documented* endpoint today.
 *
 * The method differs by entity and is not guessable — an earlier version of
 * this file assumed `POST /<entity>/search` everywhere and produced four 404s
 * that looked like missing annotations but were simply wrong paths. Each entry
 * below was checked against `docs/swagger/swagger-3-0.json`.
 */
const ENTITIES = [
  // POST /<entity>/search — a filter body, the richest of the three shapes.
  { key: 'customers', method: 'POST', path: '/customers/search', body: { limit: LIMIT } },
  { key: 'plans', method: 'POST', path: '/plans/search', body: { limit: LIMIT } },
  // `expand: 'meters'` — the API returns meter_id but embeds the meter only on
  // request. Without it a metered feature fixture carries nothing to measure by.
  { key: 'features', method: 'POST', path: '/features/search', body: { limit: LIMIT, expand: 'meters' } },
  { key: 'prices', method: 'POST', path: '/prices/search', body: { limit: LIMIT } },
  { key: 'invoices', method: 'POST', path: '/invoices/search', body: { limit: LIMIT, skip_line_items: false } },
  { key: 'subscriptions', method: 'POST', path: '/subscriptions/search', body: { limit: LIMIT } },
  { key: 'entitlements', method: 'POST', path: '/entitlements/search', body: { limit: LIMIT } },
  { key: 'wallets', method: 'POST', path: '/wallets/search', body: { limit: LIMIT } },
  { key: 'coupons', method: 'POST', path: '/coupons/search', body: { limit: LIMIT } },
  { key: 'addons', method: 'POST', path: '/addons/search', body: { limit: LIMIT } },

  // GET with query params — these have no /search route at all.
  { key: 'payments', method: 'GET', path: '/payments', query: { limit: LIMIT } },
  { key: 'taxrates', method: 'GET', path: '/taxes/rates', query: { limit: LIMIT } },
]

/**
 * Entities with no list endpoint of any kind.
 *
 * `creditnotes` and `creditgrants` document only `POST /<entity>` (create) and
 * `GET /<entity>/{id}`. Their `List*` handlers exist as live routes but carry
 * no swagger annotation, so there is no documented way to enumerate them — see
 * `docs/api-contract-gap.md`. Listed here rather than silently omitted, so the
 * gap stays visible and this array shrinks when the annotations land.
 */
const NOT_LISTABLE = [
  { key: 'creditnotes', reason: 'ListCreditNotes is unannotated; only create and get-by-id are documented' },
  { key: 'creditgrants', reason: 'ListCreditGrants is unannotated; only create and get-by-id are documented' },
]

async function capture({ key, method, path, body, query }) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v))

  const response = await fetch(url, {
    method,
    headers: {
      'x-api-key': API_KEY,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
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

for (const { key, reason } of NOT_LISTABLE) {
  console.log(`  skipped   ${key.padEnd(16)} ${reason}`)
}

console.log(`\n${captured}/${results.length} captured into src/__fixtures__/`)
if (raw) console.log('RAW capture — scrubbing was skipped. Do not commit these files.')
process.exit(results.some((r) => !r.ok) ? 1 : 0)
