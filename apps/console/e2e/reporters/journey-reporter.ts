import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter'

import { copyRedactedTrace, redact, stripAnsi } from './redact'

/**
 * One report per journey, written the moment that journey finishes, plus a
 * run summary rewritten after every journey so an interrupted run still
 * leaves everything that completed.
 *
 *   e2e-results/
 *     summary.json            counts, durations, every journey, infrastructure errors
 *     journey-inventory.md    the same as a table
 *     journeys/<id>/
 *       summary.md            the journey's report
 *       meta.json             the same, machine-readable
 *       screenshots/ video/ trace/ logs/    only when the final result is FAIL
 *
 * ## Evidence is kept for final failures only
 *
 * Playwright's `retain-on-failure` keeps the video, trace and screenshot of
 * every *attempt* that failed — so a journey that fails, is retried and passes
 * still leaves a video behind. Here the final attempt decides: a journey that
 * ends PASS has every earlier attempt's files deleted from `test-results/`
 * too, and nothing copied; a journey that ends FAIL gets its final attempt's
 * evidence copied in, with every earlier failure recorded as a retry.
 *
 * ## Nothing secret leaves
 *
 * Every text written here passes through `redact`, and a trace — which records
 * action arguments, request headers and storage — is unzipped and scrubbed
 * before it is copied (`copyRedactedTrace`), or withheld if that fails.
 *
 * Statements in "Likely cause" are inferred from the error's shape and are
 * labelled so; everything else in a report is what the run recorded.
 */

type FinalStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'NOT RUN'

interface Attempt {
  retry: number
  status: TestResult['status']
  durationMs: number
  error?: string | undefined
}

interface JourneyRecord {
  id: string
  name: string
  area: string
  file: string
  status: FinalStatus
  startedAt?: string | undefined
  durationMs: number
  retries: number
  attempts: Attempt[]
  skipReason?: string | undefined
  failure?:
    | {
        step: string | null
        message: string
        expected: string | null
        actual: string | null
        likelyCause: string[]
      }
    | undefined
  report: string
  evidence: { screenshots: string[]; video: string[]; trace: string[]; logs: string[] }
}

interface Options {
  outputDir?: string
}

const stem = (file: string) => basename(file).replace(/\.spec\.[jt]sx?$/, '')
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).replace(/-/g, ' ')

export const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

/** The test's describe path and title, without the project or file. */
function titleOf(test: TestCase): string {
  return test
    .titlePath()
    .filter((part) => part && !/\.spec\.[jt]sx?$/.test(part))
    .slice(1)
    .join(' › ')
}

/**
 * A stable, readable id: the spec file, the title and a short hash of both,
 * so two journeys whose titles slug the same never share a directory. `file`
 * is relative to the test directory, so the id is the same on every machine;
 * `scripts/e2e-journey-inventory.mjs` computes the same id for the docs.
 */
export function journeyId(file: string, describePath: string, title: string): string {
  const hash = createHash('sha1').update(`${file}::${describePath}`).digest('hex').slice(0, 6)
  return `${stem(file)}--${slug(title)}-${hash}`
}

/** `live-flows` journeys are titled `area: what it does`; the rest take their file's name. */
function areaOf(test: TestCase): string {
  const prefix = /^([a-z][a-z -]{1,30}):\s/i.exec(test.title)
  return sentence(prefix?.[1] ?? stem(test.location.file))
}

/** Every step, flattened, in the order it ran; framework plumbing left out. */
function flatten(steps: TestStep[], depth = 0, out: Array<{ step: TestStep; depth: number }> = []) {
  for (const step of steps) {
    const shown =
      step.category === 'test.step' || step.category === 'pw:api' || step.category === 'expect'
    if (shown) out.push({ step, depth })
    flatten(step.steps, shown ? depth + 1 : depth, out)
  }
  return out
}

/** The deepest step that carries the error: the one that actually failed. */
function failingStep(steps: TestStep[]): TestStep | null {
  for (const step of steps) {
    if (!step.error) continue
    return failingStep(step.steps) ?? step
  }
  return null
}

function errorText(error: TestError | undefined): string {
  if (!error) return ''
  return redact(stripAnsi(error.message ?? error.value ?? ''))
}

function field(message: string, label: string): string | null {
  const match = new RegExp(`^\\s*${label}[^:\\n]*:\\s*(.+)$`, 'mi').exec(message)
  return match?.[1]?.trim() ?? null
}

/**
 * Educated guesses from the error's shape. Never presented as fact: the
 * report prints these under "Likely cause (inferred)".
 */
function likelyCause(message: string, logs: string): string[] {
  const causes: string[] = []
  const lower = message.toLowerCase()
  if (lower.includes('abort: the selected environment')) {
    causes.push(
      'The isolation guard stopped the run: the console was not in the dedicated E2E environment. Check `E2E_ENV_ID` / `E2E_ENV_PREFIX` against the test account.',
    )
  }
  if (/sign-in/.test(message) && /tohaveurl/i.test(message)) {
    causes.push(
      'The session never left the sign-in page: the credentials may have been refused, or the API was unreachable. Check `E2E_USER` / `E2E_PASSWORD` and the API status.',
    )
  }
  if (/\b(401|403)\b/.test(logs)) {
    causes.push(
      'The API refused a request (401/403 in the network log): an expired session or a missing permission on the test account.',
    )
  }
  if (/\b5\d\d\b/.test(logs) || /net::ERR_/.test(logs)) {
    causes.push(
      'The network log shows server errors or failed requests: the backend, not the UI, may be at fault.',
    )
  }
  if (/timeout|timed out/i.test(message) && /(locator|getBy|waiting for)/i.test(message)) {
    causes.push(
      'An element the journey waits for never appeared: the copy or role it is found by changed, the page did not finish loading, or an earlier step left the UI somewhere else. The screenshot shows where it stopped.',
    )
  } else if (/test timeout/i.test(message)) {
    causes.push(
      'The journey ran out of time overall: a slow backend or an unusually long step. The trace shows which step took the time.',
    )
  }
  if (/expect\(/.test(message) && /Received/.test(message) && causes.length === 0) {
    causes.push(
      'An assertion saw a different value from the one expected: either a regression in the UI or a test expectation that no longer matches the product.',
    )
  }
  if (causes.length === 0)
    causes.push('No pattern recognised; start from the failing step, the screenshot and the trace.')
  return causes
}

class JourneyReporter implements Reporter {
  private readonly root: string
  private config!: FullConfig
  private startedAt = new Date()
  private readonly journeys = new Map<string, JourneyRecord>()
  private readonly ids = new Map<TestCase, string>()
  private readonly results = new Map<TestCase, TestResult[]>()
  private readonly infrastructure: string[] = []
  private finished = false
  private overall: FullResult['status'] | 'running' = 'running'

  constructor(options: Options = {}) {
    this.root = resolve(process.env['E2E_RESULTS_DIR'] ?? options.outputDir ?? 'e2e-results')
  }

  printsToStdio() {
    return false
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config
    this.startedAt = new Date()
    rmSync(this.root, { recursive: true, force: true })
    mkdirSync(join(this.root, 'journeys'), { recursive: true })
    for (const test of suite.allTests()) {
      const file = relative(config.rootDir, test.location.file).split('\\').join('/')
      const id = journeyId(file, titleOf(test), test.title)
      this.ids.set(test, id)
      this.journeys.set(id, {
        id,
        name: titleOf(test),
        area: areaOf(test),
        file,
        status: 'NOT RUN',
        durationMs: 0,
        retries: 0,
        attempts: [],
        report: `journeys/${id}/summary.md`,
        evidence: { screenshots: [], video: [], trace: [], logs: [] },
      })
    }
    this.writeSummary()
  }

  onError(error: TestError) {
    this.infrastructure.push(errorText(error).split('\n').slice(0, 6).join('\n'))
    this.writeSummary()
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const all = [...(this.results.get(test) ?? []), result]
    this.results.set(test, all)

    const passed = result.status === 'passed' || result.status === test.expectedStatus
    const final =
      passed ||
      result.status === 'skipped' ||
      result.status === 'interrupted' ||
      result.retry >= test.retries
    if (!final) return

    const journey = this.journeys.get(this.ids.get(test) ?? '')
    if (!journey) return
    journey.attempts = all.map((r) => ({
      retry: r.retry,
      status: r.status,
      durationMs: r.duration,
      ...(r.error ? { error: errorText(r.error).split('\n')[0] } : {}),
    }))
    journey.retries = all.length - 1
    journey.startedAt = all[0]?.startTime.toISOString()
    journey.durationMs = all.reduce((sum, r) => sum + r.duration, 0)
    journey.status =
      result.status === 'skipped'
        ? 'SKIPPED'
        : test.outcome() === 'expected' || test.outcome() === 'flaky'
          ? 'PASS'
          : 'FAIL'
    if (journey.status === 'SKIPPED') {
      journey.skipReason = test.annotations.find((a) => a.type === 'skip')?.description
    }

    const dir = join(this.root, 'journeys', journey.id)
    mkdirSync(dir, { recursive: true })

    if (journey.status === 'FAIL') {
      this.collectEvidence(journey, result, dir)
    } else {
      // A journey that ends well keeps nothing heavy, including what an
      // earlier failed attempt left behind.
      for (const attempt of all) {
        for (const attachment of attempt.attachments) {
          if (attachment.path) rmSync(attachment.path, { force: true })
        }
      }
    }

    writeFileSync(join(dir, 'summary.md'), this.renderJourney(test, journey, result))
    writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(journey, null, 2)}\n`)
    this.writeSummary()
  }

  private collectEvidence(journey: JourneyRecord, result: TestResult, dir: string) {
    const take = (kind: keyof JourneyRecord['evidence'], name: string) => {
      mkdirSync(join(dir, kind), { recursive: true })
      const path = `${kind}/${name}`
      journey.evidence[kind].push(path)
      return join(dir, path)
    }
    const counts: Record<string, number> = {}
    const unique = (name: string) => {
      counts[name] = (counts[name] ?? 0) + 1
      const n = counts[name]
      return n === 1 ? name : `${basename(name, extname(name))}-${n}${extname(name)}`
    }

    let networkLog = ''
    for (const attachment of result.attachments) {
      if (attachment.name === 'video' && attachment.path && existsSync(attachment.path)) {
        copyFileSync(
          attachment.path,
          take('video', unique(`${journey.id}${extname(attachment.path) || '.webm'}`)),
        )
      } else if (attachment.name === 'trace' && attachment.path && existsSync(attachment.path)) {
        const destination = join(dir, 'trace', unique('trace.zip'))
        mkdirSync(join(dir, 'trace'), { recursive: true })
        if (copyRedactedTrace(attachment.path, destination)) {
          journey.evidence.trace.push(relative(dir, destination))
        } else {
          writeFileSync(
            join(dir, 'trace', 'WITHHELD.txt'),
            'The trace could not be scrubbed of credentials, so it was not copied.\n',
          )
          journey.evidence.trace.push('trace/WITHHELD.txt')
        }
      } else if (
        attachment.contentType.startsWith('image/') &&
        attachment.path &&
        existsSync(attachment.path)
      ) {
        copyFileSync(attachment.path, take('screenshots', unique(basename(attachment.path))))
      } else if (attachment.body && attachment.contentType.startsWith('text/')) {
        const text = redact(attachment.body.toString('utf8'))
        if (attachment.name === 'network-errors') networkLog = text
        writeFileSync(take('logs', unique(`${slug(attachment.name)}.log`)), `${text}\n`)
      }
    }

    const output = [
      ...result.stdout.map((chunk) => `[stdout] ${chunk.toString()}`),
      ...result.stderr.map((chunk) => `[stderr] ${chunk.toString()}`),
    ].join('')
    if (output.trim()) writeFileSync(take('logs', 'output.log'), redact(stripAnsi(output)))

    const errors = result.errors.map((error) => {
      const message = errorText(error)
      const stack = error.stack ? redact(stripAnsi(error.stack)) : ''
      return stack.includes(message.split('\n')[0] ?? '') ? stack : `${message}\n${stack}`
    })
    if (errors.length > 0)
      writeFileSync(take('logs', 'error.txt'), `${errors.join('\n\n---\n\n')}\n`)

    const message = errorText(result.error ?? result.errors[0])
    const step = failingStep(result.steps)
    journey.failure = {
      step: step ? redact(step.titlePath().join(' › ')) : null,
      message: message.split('\n').find((line) => line.trim()) ?? 'Unknown error',
      expected: field(message, 'Expected'),
      actual:
        field(message, 'Received') ??
        message
          .split('\n')
          .slice(1)
          .find((line) => /^\s*Error:/.test(line))
          ?.replace(/^\s*Error:\s*/, '') ??
        null,
      likelyCause: likelyCause(message, networkLog),
    }
  }

  private renderJourney(test: TestCase, journey: JourneyRecord, result: TestResult): string {
    const target =
      process.env['E2E_TARGET_NAME'] || process.env['E2E_BASE_URL'] || 'mocked build (localhost)'
    const steps = flatten(result.steps)
    const lines: string[] = [
      `# ${journey.status} — ${journey.name}`,
      '',
      `| | |`,
      `|---|---|`,
      `| Journey ID | \`${journey.id}\` |`,
      `| Area | ${journey.area} |`,
      `| Spec | \`${journey.file}:${test.location.line}\` |`,
      `| Status | **${journey.status}** |`,
      `| Duration | ${formatDuration(journey.durationMs)} |`,
      `| Attempts | ${journey.attempts.length}${journey.retries > 0 ? ` (${journey.attempts.map((a) => a.status).join(' → ')})` : ''} |`,
      `| Started | ${journey.startedAt ?? '—'} |`,
      `| Target | ${redact(target)} |`,
      `| Release | ${process.env['E2E_RELEASE'] || process.env['GITHUB_SHA']?.slice(0, 7) || 'local'} |`,
      '',
      '## What it checks',
      '',
      `${journey.name}.`,
      '',
    ]

    if (journey.status === 'SKIPPED') {
      lines.push(
        '## Skipped',
        '',
        journey.skipReason ? redact(journey.skipReason) : 'No reason given.',
        '',
      )
    }

    if (steps.length > 0) {
      lines.push('## Steps', '')
      const shown = steps.slice(0, 80)
      for (const { step, depth } of shown) {
        const mark = step.error ? '✗' : '✓'
        lines.push(
          `${'  '.repeat(depth)}- ${mark} ${redact(step.title)} (${formatDuration(step.duration)})`,
        )
      }
      if (steps.length > shown.length)
        lines.push(`- … ${steps.length - shown.length} more steps in the trace`)
      lines.push('')
    }

    if (journey.status === 'PASS') {
      lines.push(
        '## Expected vs actual',
        '',
        'Expected: every step completes and every assertion holds.',
        `Actual: as expected${journey.retries > 0 ? `, but only after ${journey.retries} retr${journey.retries === 1 ? 'y' : 'ies'} — treat that as a finding (\`e2e/AGENTS.md\`: a flaky test is a broken test)` : ''}.`,
        '',
      )
    }

    if (journey.failure) {
      const f = journey.failure
      lines.push(
        '## Failure',
        '',
        `- **Failed at:** ${f.step ? `\`${f.step}\`` : 'outside a step (a hook or fixture)'}`,
        `- **Error:** ${f.message}`,
        `- **Expected:** ${f.expected ?? 'every step completes and every assertion holds'}`,
        `- **Actual:** ${f.actual ?? f.message}`,
        '',
        '```',
        ...result.errors
          .map((e) => errorText(e))
          .join('\n\n')
          .split('\n')
          .slice(0, 40),
        '```',
        '',
        '## Evidence',
        '',
      )
      const list = (label: string, paths: string[]) =>
        lines.push(
          `- **${label}:** ${paths.length > 0 ? paths.map((p) => `[${p}](${p})`).join(', ') : 'none captured'}`,
        )
      list('Screenshots', journey.evidence.screenshots)
      list('Video', journey.evidence.video)
      list('Trace', journey.evidence.trace)
      list('Logs', journey.evidence.logs)
      if (journey.evidence.trace.some((p) => p.endsWith('.zip'))) {
        lines.push(
          '',
          'Open a trace with `pnpm exec playwright show-trace <trace.zip>` or at trace.playwright.dev.',
        )
      }
      lines.push(
        '',
        '## Likely cause (inferred — not confirmed)',
        '',
        ...f.likelyCause.map((c) => `- ${c}`),
        '',
        '## Next steps',
        '',
        `- Re-run just this journey: \`pnpm --filter console test:e2e:journey "${test.title.replace(/"/g, '\\"')}"\``,
        '- Step through the trace from the failing step backwards.',
        '',
      )
    }

    if (journey.attempts.length > 1) {
      lines.push('## Attempts', '')
      for (const attempt of journey.attempts) {
        lines.push(
          `- Attempt ${attempt.retry + 1}: ${attempt.status} in ${formatDuration(attempt.durationMs)}${attempt.error ? ` — ${attempt.error}` : ''}`,
        )
      }
      lines.push('')
    }
    return `${lines.join('\n')}\n`
  }

  private writeSummary() {
    const journeys = [...this.journeys.values()]
    const count = (status: FinalStatus) => journeys.filter((j) => j.status === status).length
    const failed = count('FAIL')
    const notRun = count('NOT RUN')
    const status = !this.finished
      ? 'RUNNING'
      : failed > 0
        ? 'FAIL'
        : this.overall !== 'passed' || notRun > 0 || this.infrastructure.length > 0
          ? 'PARTIAL'
          : 'PASS'
    const finishedAt = new Date()
    const summary = {
      status,
      runStatus: this.overall,
      startedAt: this.startedAt.toISOString(),
      finishedAt: this.finished ? finishedAt.toISOString() : null,
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      target: redact(
        process.env['E2E_TARGET_NAME'] || process.env['E2E_BASE_URL'] || 'mocked build (localhost)',
      ),
      release: {
        sha: process.env['E2E_RELEASE_SHA'] || process.env['GITHUB_SHA'] || null,
        ref: process.env['E2E_RELEASE'] || process.env['GITHUB_REF_NAME'] || null,
        deploymentUrl: process.env['E2E_DEPLOYMENT_URL'] || null,
      },
      retriesAllowed: this.config?.projects[0]?.retries ?? 0,
      counts: {
        total: journeys.length,
        passed: count('PASS'),
        failed,
        skipped: count('SKIPPED'),
        notRun,
        retried: journeys.filter((j) => j.retries > 0).length,
      },
      infrastructure: this.infrastructure,
      journeys,
    }
    writeFileSync(join(this.root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
    writeFileSync(
      join(this.root, 'journey-inventory.md'),
      this.renderInventory(summary.status, journeys),
    )
  }

  private renderInventory(status: string, journeys: JourneyRecord[]): string {
    const rows = journeys.map(
      (j) =>
        `| \`${j.id}\` | ${j.name.replace(/\|/g, '\\|')} | ${j.area} | \`${j.file}\` | ${j.status} | ${j.status === 'NOT RUN' ? '—' : formatDuration(j.durationMs)} | ${j.retries} | [report](${j.report}) |`,
    )
    return [
      `# E2E journey results — ${status}`,
      '',
      `Started ${this.startedAt.toISOString()}. Generated by \`e2e/reporters/journey-reporter.ts\`; the documented inventory is \`docs/e2e-journeys.md\`.`,
      '',
      '| ID | Journey | Area | Spec | Status | Duration | Retries | Report |',
      '|---|---|---|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n')
  }

  onEnd(result: FullResult) {
    this.finished = true
    this.overall = result.status
    this.writeSummary()
  }
}

export default JourneyReporter
