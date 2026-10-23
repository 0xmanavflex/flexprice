#!/usr/bin/env node
// Turns Playwright's JSON report into the Slack message `e2e.yml` posts.
//
//   node .github/scripts/e2e-slack-summary.mjs <playwright-results.json>
//
// Prints a Slack incoming-webhook payload (`{"text": …}`) on stdout. The
// workflow pipes it to `curl`; nothing here touches the network, so it can be
// run locally against any report to see the message.
//
// Context comes from the environment GitHub Actions already sets, plus:
//   E2E_ENVIRONMENT  what was tested, e.g. "main (production deploy)"
//   E2E_TARGET       the URL the journeys ran against, or empty for the mocked build
//   E2E_OUTCOME      the journeys step's outcome, used when there is no report
import { readFileSync } from 'node:fs'

const reportPath = process.argv[2] ?? 'apps/console/playwright-results.json'
const env = process.env

/** Slack mrkdwn treats these three as control characters. */
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Every spec in the report, flattened, with the file and describe path it sits under. */
function collect(suites, trail = [], out = []) {
  for (const suite of suites ?? []) {
    const here = suite.title && !suite.title.endsWith('.ts') ? [...trail, suite.title] : trail
    for (const spec of suite.specs ?? []) {
      const tests = spec.tests ?? []
      // `expected`, `unexpected`, `flaky` or `skipped`, one per project.
      const statuses = tests.map((t) => t.status)
      const status = statuses.includes('unexpected')
        ? 'failed'
        : statuses.includes('flaky')
          ? 'flaky'
          : statuses.length > 0 && statuses.every((s) => s === 'skipped')
            ? 'skipped'
            : 'passed'
      const tags = [...(spec.tags ?? []), ...tests.flatMap((t) => t.tags ?? [])].map((tag) =>
        tag.replace(/^@/, ''),
      )
      out.push({
        file: spec.file ?? suite.file ?? '',
        title: [...here, spec.title].join(' › '),
        status,
        journey: tags.includes('journey'),
      })
    }
    collect(suite.suites, here, out)
  }
  return out
}

const runUrl =
  env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : ''
const sha = (env.GITHUB_SHA ?? '').slice(0, 7)
const commitUrl =
  env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_SHA
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/commit/${env.GITHUB_SHA}`
    : ''
const environment = env.E2E_ENVIRONMENT || env.GITHUB_REF_NAME || 'local'
const target = env.E2E_TARGET ? `<${env.E2E_TARGET}|${escape(env.E2E_TARGET)}>` : 'the mocked build'

const footer = [
  `*Environment:* ${escape(environment)} · *Target:* ${target}`,
  sha ? `*Commit:* ${commitUrl ? `<${commitUrl}|${sha}>` : sha}` : '',
  runUrl ? `<${runUrl}|Open the run>` : '',
]
  .filter(Boolean)
  .join(' · ')

let report = null
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
  // No report: the suite never got as far as running — the server did not
  // start, the install failed. Say so rather than staying silent.
}

const lines = []
if (!report) {
  const outcome = env.E2E_OUTCOME || 'unknown'
  lines.push(
    `:x: *E2E journeys did not report* on ${escape(environment)} — the run ended with \`${escape(outcome)}\` before Playwright wrote results.`,
  )
} else {
  const specs = collect(report.suites)
  const failed = specs.filter((s) => s.status === 'failed')
  const passed = specs.filter((s) => s.status === 'passed')
  const flaky = specs.filter((s) => s.status === 'flaky')
  const skipped = specs.filter((s) => s.status === 'skipped')
  const journeys = specs.filter((s) => s.journey)
  // A crash outside any test (a broken global setup, a config error) leaves
  // `errors` and no failing spec; that is still a red run.
  const errors = report.errors ?? []
  const red = failed.length > 0 || errors.length > 0

  const counts = [
    `${passed.length} passed`,
    failed.length ? `${failed.length} failed` : '',
    flaky.length ? `${flaky.length} flaky` : '',
    skipped.length ? `${skipped.length} skipped` : '',
  ]
    .filter(Boolean)
    .join(', ')

  lines.push(
    red
      ? `:x: *E2E: ${failed.length === 1 ? 'a journey failed' : `${failed.length || 'the'} journeys failed`}* on ${escape(environment)} — ${counts}`
      : `:white_check_mark: *E2E: these journeys passed* on ${escape(environment)} — ${counts}`,
  )

  if (failed.length) {
    lines.push('', '*Failed*')
    for (const s of failed.slice(0, 15)) lines.push(`• \`${escape(s.file)}\` › ${escape(s.title)}`)
    if (failed.length > 15) lines.push(`• …and ${failed.length - 15} more`)
  }
  if (errors.length) {
    lines.push('', '*Errors outside a test*')
    for (const e of errors.slice(0, 3))
      lines.push(
        `• ${escape(
          String(e.message ?? e)
            .split('\n')[0]
            .slice(0, 200),
        )}`,
      )
  }
  if (journeys.length) {
    lines.push('', '*Customer journeys*')
    const mark = {
      passed: ':white_check_mark:',
      failed: ':x:',
      flaky: ':warning:',
      skipped: ':fast_forward:',
    }
    for (const j of journeys) lines.push(`${mark[j.status]} ${escape(j.title)}`)
  }
}

lines.push('', footer)
process.stdout.write(JSON.stringify({ text: lines.join('\n') }))
