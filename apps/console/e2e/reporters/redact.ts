import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Everything the journey reporter writes passes through here first.
 *
 * Two layers, because neither alone is enough:
 *   1. The exact values of the credentials this run was given (`E2E_PASSWORD`
 *      and the rest below) — whatever the context they turn up in.
 *   2. The shapes a credential takes when the run never named it: a bearer
 *      token in a header, a JWT in local storage, a Slack webhook or token, a
 *      `"password": …` in a JSON body.
 */
const SECRET_ENV = [
  'E2E_PASSWORD',
  'E2E_USER',
  'E2E_EMAIL',
  'E2E_SLACK_WEBHOOK_URL',
  'SLACK_E2E_WEBHOOK_URL',
  'E2E_SLACK_BOT_TOKEN',
  'SLACK_BOT_TOKEN',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
]

const PATTERNS: Array<[RegExp, string]> = [
  [/(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED-JWT]'],
  [/https:\/\/hooks\.slack\.com\/[^\s"'<>)]+/g, '[REDACTED-WEBHOOK]'],
  [/xox[abposr]-[A-Za-z0-9-]+/g, '[REDACTED-SLACK-TOKEN]'],
  [
    /("(?:token|access_token|refresh_token|id_token|password|api_key|apiKey|secret)"\s*:\s*)"[^"]*"/gi,
    '$1"[REDACTED]"',
  ],
  // The same keys inside a JSON string (local storage holds the session that way).
  [
    /(\\"(?:token|access_token|refresh_token|id_token|password|api_key|apiKey|secret)\\"\s*:\s*\\")[^\\"]*/gi,
    '$1[REDACTED]',
  ],
  // Headers as a trace records them: `{"name":"authorization","value":"…"}`.
  [
    /("name"\s*:\s*"(?:authorization|cookie|set-cookie|x-api-key|x-vercel-protection-bypass)"\s*,\s*"value"\s*:\s*)"[^"]*"/gi,
    '$1"[REDACTED]"',
  ],
  [
    /((?:x-api-key|cookie|set-cookie|authorization)["']?\s*[:=]\s*["']?)[^"'\n,}]+/gi,
    '$1[REDACTED]',
  ],
]

function secretValues(): string[] {
  return SECRET_ENV.map((name) => process.env[name])
    .filter((value): value is string => !!value && value.length >= 4)
    .sort((a, b) => b.length - a.length)
}

export function redact(text: string): string {
  let out = text
  for (const value of secretValues()) out = out.split(value).join('[REDACTED]')
  // Also as it appears URL- or JSON-encoded.
  for (const value of secretValues()) {
    const encoded = [encodeURIComponent(value), JSON.stringify(value).slice(1, -1)]
    for (const form of encoded) if (form !== value) out = out.split(form).join('[REDACTED]')
  }
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out
}

/** Terminal colour codes, which Playwright leaves in error messages. */
export const stripAnsi = (text: string) =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\u001b\[[0-9;]*m/g, '')

const isText = (buffer: Buffer) => !buffer.subarray(0, 8192).includes(0)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

/**
 * Copies a Playwright trace with every text entry redacted.
 *
 * A trace records each action's arguments (the password `fill` included),
 * every request's headers (the bearer token) and the page's storage, so it is
 * the one piece of evidence that is unsafe by default. It is unzipped,
 * scrubbed entry by entry and zipped again; if any part of that fails the
 * trace is withheld rather than copied as-is. Returns whether it was written.
 */
export function copyRedactedTrace(source: string, destination: string): boolean {
  const work = mkdtempSync(join(tmpdir(), 'e2e-trace-'))
  try {
    execFileSync('unzip', ['-q', source, '-d', work], { stdio: 'ignore' })
    for (const file of walk(work)) {
      const buffer = readFileSync(file)
      if (!isText(buffer)) continue
      const text = buffer.toString('utf8')
      const clean = redact(text)
      if (clean !== text) writeFileSync(file, clean)
    }
    rmSync(destination, { force: true })
    execFileSync('zip', ['-q', '-r', '-X', resolve(destination), '.'], {
      cwd: work,
      stdio: 'ignore',
    })
    return true
  } catch {
    rmSync(destination, { force: true })
    return false
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
