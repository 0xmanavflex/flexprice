// Names the failing journeys of a mocked E2E run.
//
//   node .github/scripts/e2e-summary.mjs apps/console/playwright-results.json
//
// Reads Playwright's JSON report and writes, to the job summary, the totals and
// a table of every failed or flaky journey with its first error line. Each
// failure is also printed as a `::error` annotation, so it shows on the pull
// request beside the spec. Never fails the step: the journeys' own step decides
// the job's result.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const reportPath = process.argv[2]
const summaryPath = process.env.GITHUB_STEP_SUMMARY
const write = (text) =>
  summaryPath ? appendFileSync(summaryPath, text) : process.stdout.write(text)

if (!reportPath || !existsSync(reportPath)) {
  write(
    `### E2E journeys\n\nNo report at \`${reportPath}\`: the run stopped before any journey finished.\n`,
  )
  process.exit(0)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const repoRoot = process.env.GITHUB_WORKSPACE ?? process.cwd()

/** Every spec in the report, flattened out of its nested suites. */
function* specs(suites, parents = []) {
  for (const suite of suites ?? []) {
    const path =
      suite.title && !suite.file?.endsWith(suite.title) ? [...parents, suite.title] : parents
    for (const spec of suite.specs ?? []) yield { spec, path }
    yield* specs(suite.suites, path)
  }
}

const firstLine = (text) =>
  (text ?? '')
    // Strip terminal colour codes.
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? ''

const cell = (text) => text.replace(/\|/g, '\\|')

const rows = []
for (const { spec, path } of specs(report.suites)) {
  for (const test of spec.tests ?? []) {
    if (test.status !== 'unexpected' && test.status !== 'flaky') continue
    const failed = (test.results ?? []).find(
      (result) => result.status !== 'passed' && result.status !== 'skipped',
    )
    const message = firstLine(failed?.error?.message ?? failed?.errors?.[0]?.message)
    const file = spec.file ?? ''
    const title = [...path, spec.title].join(' › ')
    rows.push({ status: test.status, file, line: spec.line, title, message })
  }
}

const stats = report.stats ?? {}
const minutes = stats.duration ? `${(stats.duration / 60000).toFixed(1)} min` : 'unknown time'
let text = `### E2E journeys\n\n`
text += `${stats.expected ?? 0} passed · ${stats.unexpected ?? 0} failed · ${stats.flaky ?? 0} flaky · ${stats.skipped ?? 0} skipped · ${minutes}\n\n`

if (rows.length) {
  text += `| Result | Journey | Spec | First error |\n| --- | --- | --- | --- |\n`
  for (const row of rows) {
    text += `| ${row.status === 'flaky' ? 'Flaky' : 'Failed'} | ${cell(row.title)} | \`${row.file}:${row.line}\` | ${cell(row.message)} |\n`
  }
  text += `\nTraces, videos and screenshots are in the \`playwright-${process.env.GITHUB_RUN_ID ?? ''}\` artifact.\n`
}
write(text)

// Annotations point at the spec as the repository spells it.
const testDir = report.config?.rootDir
  ? relative(repoRoot, report.config.rootDir)
  : 'apps/console/e2e'
for (const row of rows) {
  if (row.status !== 'unexpected') continue
  const file = `${testDir}/${row.file}`.replace(/^\/+/, '')
  const message = `${row.title}: ${row.message}`.replace(/\r?\n/g, ' ')
  console.log(`::error file=${file},line=${row.line},title=Journey failed::${message}`)
}
