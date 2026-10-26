#!/usr/bin/env node
// Writes docs/e2e-journeys.md: every E2E journey, read from the spec files
// themselves, with the result and duration of an actual run.
//
//   node scripts/e2e-journey-inventory.mjs [summary.json …]
//
// Journeys come from `playwright test --list` (so a test Playwright would not
// run is not documented as if it would). Steps, expectations and setup are
// read from each test's source; status and duration come from the
// `e2e-results/summary.json` files given (a mocked run, a live run, or both —
// a later file wins for the same journey). A journey with no result reads
// "not run in the recorded runs", never PASS.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const consoleDir = join(root, 'apps/console')
const e2eDir = join(consoleDir, 'e2e')
const output = join(root, 'docs/e2e-journeys.md')

// ── the same id the journey reporter uses (e2e/reporters/journey-reporter.ts) ──
const stem = (file) => basename(file).replace(/\.spec\.[jt]sx?$/, '')
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
const journeyId = (file, describePath, title) =>
  `${stem(file)}--${slug(title)}-${createHash('sha1').update(`${file}::${describePath}`).digest('hex').slice(0, 6)}`

const formatDuration = (ms) => {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

// ── 1. what Playwright would run ──────────────────────────────────────────────
const listed = JSON.parse(
  execFileSync(
    join(consoleDir, 'node_modules/.bin/playwright'),
    ['test', '--list', '--reporter=json'],
    {
      cwd: consoleDir,
      encoding: 'utf8',
      env: { ...process.env, CI: '' },
      maxBuffer: 64 * 1024 * 1024,
    },
  ),
)

const journeys = []
const walk = (suite, describes) => {
  const here =
    suite.title && !/\.spec\.[jt]sx?$/.test(suite.title) ? [...describes, suite.title] : describes
  for (const spec of suite.specs ?? []) {
    const name = [...here, spec.title].join(' › ')
    journeys.push({
      id: journeyId(spec.file, name, spec.title),
      file: spec.file,
      line: spec.line,
      title: spec.title,
      name,
    })
  }
  for (const child of suite.suites ?? []) walk(child, here)
}
for (const suite of listed.suites) walk(suite, [])

// ── 2. results of actual runs ─────────────────────────────────────────────────
const results = new Map()
const runs = []
for (const path of process.argv.slice(2)) {
  if (!existsSync(path)) continue
  const summary = JSON.parse(readFileSync(path, 'utf8'))
  runs.push({ path, summary })
  for (const j of summary.journeys ?? [])
    results.set(j.id, { ...j, target: summary.target, startedAt: summary.startedAt })
}

// ── 3. what each test does, from its source ───────────────────────────────────
const sources = new Map()
const source = (file) => {
  if (!sources.has(file)) sources.set(file, readFileSync(join(e2eDir, file), 'utf8'))
  return sources.get(file)
}

/** The test's body: from its line to the brace that closes it. */
function body(file, line) {
  const lines = source(file).split('\n')
  const out = []
  let depth = 0
  let started = false
  for (let i = line - 1; i < lines.length; i++) {
    const text = lines[i]
    out.push(text)
    for (const ch of text.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) {
      if (ch === '{') {
        depth++
        started = true
      } else if (ch === '}') depth--
    }
    if (started && depth <= 0) break
  }
  return out.slice(1, -1)
}

const clean = (line) =>
  line
    .trim()
    .replace(/^await\s+/, '')
    .replace(/;$/, '')

function describeTest(journey) {
  const lines = body(journey.file, journey.line)
  const steps = []
  const expectations = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('//')) {
      steps.push(`_${line.replace(/^\/\/\s?/, '')}_`)
      continue
    }
    if (/\bexpect(\.poll)?\(/.test(line)) {
      expectations.push(`\`${clean(line).slice(0, 160)}\``)
      continue
    }
    if (/^await\b|\btest\.step\(/.test(line) || /^const \w+ = await\b/.test(line)) {
      const step = clean(line)
      if (/^[\w.]+$/.test(step)) continue
      steps.push(`\`${step.slice(0, 160)}\``)
    }
  }
  return { steps, expectations }
}

function setupOf(file) {
  const text = source(file)
  const notes = []
  const live = /^live-/.test(file)
  if (live) {
    notes.push(
      'Live: a deployed or locally served console against the real API. Needs `E2E_LIVE=1`, `E2E_USER`, `E2E_PASSWORD`, `E2E_BASE_URL`' +
        (file.includes('flows')
          ? ', `E2E_ENV_ID` (+ `E2E_ENV_PREFIX`)'
          : ', and `E2E_ENVIRONMENT` for the catalogue check') +
        '. Skipped without them.',
    )
  } else {
    notes.push(
      'Mocked console (`VITE_USE_MOCKS=true`, MSW fixture corpus); no account, no network.',
    )
  }
  if (/flexprice\.session/.test(text))
    notes.push('A signed-in demo session is seeded into `localStorage` before each test.')
  if (/test\.beforeAll\(/.test(text)) notes.push('Shared `beforeAll` setup in the file runs first.')
  if (/test\.beforeEach\(/.test(text)) notes.push('`beforeEach` setup in the file runs before it.')
  return { live, notes }
}

function dependenciesOf(file) {
  const text = source(file)
  if (/describe\.configure\(\{\s*mode:\s*'serial'/.test(text))
    return 'Serial: depends on the earlier tests in the same file.'
  if (file === 'live-flows.spec.ts') {
    return 'The file’s `beforeAll` sign-in and switch to the dedicated environment; otherwise independent (each journey creates the records it uses, named `e2e-<timestamp>-…`).'
  }
  return 'None — independent of other journeys.'
}

// ── 4. coverage gaps: routes no journey visits (approximate) ──────────────────
const router = readFileSync(join(consoleDir, 'src/app/router.tsx'), 'utf8')
const routes = [...router.matchAll(/path: '([^']+)'/g)].map((m) => m[1])
const allSpecs = [...new Set(journeys.map((j) => j.file))].map((f) => source(f)).join('\n')
const visited = (route) => {
  const prefix = route.split('/$')[0]
  if (prefix === '/' || prefix === '') return /goto\('\/'\)/.test(allSpecs)
  const escaped = prefix.replace(/\//g, '\\/')
  return (
    allSpecs.includes(`'${prefix}`) ||
    allSpecs.includes(`\`${prefix}`) ||
    allSpecs.includes(escaped) ||
    allSpecs.includes(`"${prefix}`)
  )
}
const unvisited = routes.filter((route) => !visited(route))

// ── 5. the document ───────────────────────────────────────────────────────────
const byFile = new Map()
for (const j of journeys) byFile.set(j.file, [...(byFile.get(j.file) ?? []), j])

const statusOf = (j) => results.get(j.id)?.status ?? 'NOT RUN'
const count = (s) => journeys.filter((j) => statusOf(j) === s).length
const liveCount = journeys.filter((j) => j.file.startsWith('live-')).length

const doc = []
doc.push(
  '# E2E journeys',
  '',
  '<!-- Generated by `node scripts/e2e-journey-inventory.mjs <summary.json …>`. Edit the specs, then regenerate. -->',
  '',
  `Every journey Playwright runs (\`playwright test --list\`), **${journeys.length} in ${byFile.size} spec files**, read from the specs themselves. ${liveCount} are *live* (\`e2e/live-*.spec.ts\`, against a real deployment and API); the other ${journeys.length - liveCount} run against the mocked console.`,
  '',
  'How the suite runs, where it reports and how to configure it: [`docs/e2e-testing.md`](e2e-testing.md).',
  '',
  '## Recorded runs',
  '',
)
if (runs.length === 0) {
  doc.push('No run results were given; every status below reads NOT RUN.', '')
} else {
  doc.push(
    '| Run | Target | Started | Status | Passed | Failed | Skipped | Not run | Retried | Duration |',
    '|---|---|---|---|---|---|---|---|---|---|',
  )
  for (const { path, summary } of runs) {
    const c = summary.counts
    doc.push(
      `| \`${basename(join(path, '..'))}/${basename(path)}\` | ${summary.target} | ${summary.startedAt} | ${summary.status} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.notRun} | ${c.retried} | ${formatDuration(summary.durationMs)} |`,
    )
  }
  doc.push('')
}
doc.push(
  `Across the inventory: **${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('SKIPPED')} SKIPPED, ${count('NOT RUN')} NOT RUN.**`,
  '',
  'Per-run evidence (reports, and screenshots / video / trace / logs for failed journeys only) is in the `e2e-results` artifact of each workflow run, at `journeys/<id>/`.',
  '',
  '## Index',
  '',
  '| ID | Journey | Area | Status | Duration |',
  '|---|---|---|---|---|',
)
for (const j of journeys) {
  const r = results.get(j.id)
  doc.push(
    `| [\`${j.id}\`](#${j.id}) | ${j.name.replace(/\|/g, '\\|')} | ${stem(j.file)} | ${statusOf(j)} | ${r ? formatDuration(r.durationMs) : '—'} |`,
  )
}
doc.push('')

doc.push('## Known gaps', '')
const skipped = journeys.filter((j) => statusOf(j) === 'SKIPPED')
doc.push(
  `- **Live coverage is narrow.** Only the ${liveCount} live journeys exercise a real deployment; they cover sign-in, the catalogue read and create/edit/delete of catalogue entities (features, groups, add-ons, coupons, price units, cost sheets, tax rates, customers, plans). Subscriptions/contracts, invoices, payments, credit notes, wallets, events and integrations are only covered against the mocked API.`,
  '- **Live journeys need configuration.** Without `E2E_LIVE=1` and the credentials they are SKIPPED, by design.',
  '- **Leftover live data.** Journeys that archive rather than delete (coupons, plans) or create features leave `e2e-<timestamp>-…` records in the dedicated environment; nothing outside it is touched (three isolation guards in `live-flows.spec.ts`).',
)
if (skipped.length > 0) {
  doc.push(
    `- **Skipped in the recorded runs (${skipped.length}):** ${skipped.map((j) => `\`${j.id}\``).join(', ')}.`,
  )
}
if (unvisited.length > 0) {
  doc.push(
    `- **Routes no journey visits** (approximate — a literal search of the specs for each route's path): ${unvisited.map((r) => `\`${r}\``).join(', ')}.`,
  )
}
doc.push('')

doc.push('## Journeys', '')
for (const [file, list] of byFile) {
  const setup = setupOf(file)
  doc.push(`### ${stem(file)} — \`apps/console/e2e/${file}\``, '')
  for (const j of list) {
    const r = results.get(j.id)
    const { steps, expectations } = describeTest(j)
    doc.push(
      `#### ${j.id}`,
      '',
      `**${j.name}** · \`${file}:${j.line}\``,
      '',
      `- **Area:** ${stem(file).replace(/-/g, ' ')}${setup.live ? ' (live)' : ''}`,
      `- **Preconditions and data:** ${setup.notes.join(' ')}`,
      `- **Dependencies:** ${dependenciesOf(file)}`,
      `- **Status:** ${r ? `${r.status}${r.retries ? ` after ${r.retries} retr${r.retries === 1 ? 'y' : 'ies'}` : ''}, ${formatDuration(r.durationMs)} (${r.target}, ${r.startedAt})` : 'NOT RUN in the recorded runs'}`,
    )
    if (r?.status === 'SKIPPED' && r.skipReason) doc.push(`- **Skip reason:** ${r.skipReason}`)
    if (r?.failure) {
      doc.push(
        `- **Failed at:** \`${r.failure.step ?? 'a hook or fixture'}\``,
        `- **Error:** ${r.failure.message}`,
        `- **Evidence:** \`e2e-results/${r.report}\`${['screenshots', 'video', 'trace', 'logs']
          .flatMap((k) => r.evidence[k])
          .map((p) => `, \`${p}\``)
          .join('')}`,
      )
    } else {
      doc.push(`- **Report:** \`e2e-results/journeys/${j.id}/summary.md\` in the run's artifact`)
    }
    doc.push('', '<details><summary>Steps and assertions (from the source)</summary>', '')
    if (steps.length > 0) {
      doc.push('Steps:', '', ...steps.slice(0, 40).map((s, i) => `${i + 1}. ${s}`))
      if (steps.length > 40) doc.push(`${41}. … ${steps.length - 40} more in the spec`)
      doc.push('')
    }
    doc.push(
      'Expected:',
      '',
      ...(expectations.length > 0
        ? expectations.slice(0, 30).map((e) => `- ${e}`)
        : ['- Every step completes without an error.']),
    )
    if (expectations.length > 30) doc.push(`- … ${expectations.length - 30} more in the spec`)
    doc.push('', '</details>', '')
  }
}

writeFileSync(output, `${doc.join('\n')}\n`)
console.log(`Wrote ${output}: ${journeys.length} journeys, ${results.size} with results.`)
