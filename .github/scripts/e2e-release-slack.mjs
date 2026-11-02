#!/usr/bin/env node
// Posts the one Slack report for a release-triggered E2E run (`e2e-release.yml`).
//
//   node .github/scripts/e2e-release-slack.mjs <e2e-results dir>
//
// Reads `<dir>/summary.json` (written by `apps/console/e2e/reporters/journey-reporter.ts`)
// and posts exactly one message:
//
//   - With a bot token (`E2E_SLACK_BOT_TOKEN` + `E2E_SLACK_CHANNEL_ID`): the
//     failed journeys' videos are uploaded with Slack's external-upload API and
//     shared *as that one message* — the report is the upload's comment, so
//     text and recordings arrive together. With no failures, or if any upload
//     step fails, the same text goes out through `chat.postMessage` with the
//     artifact link in place of the videos. On a re-run of a release that was
//     already reported, the new report is a reply in that release's thread,
//     not a second top-level message.
//   - With only an incoming webhook (`E2E_SLACK_WEBHOOK_URL`): the text, with
//     the artifact link for videos — a webhook cannot carry files.
//   - With neither, or without `E2E_SLACK_ENABLED=1`: prints the message and
//     sends nothing. Local runs never set it, so they never post.
//
// It never fails the job: a reporting problem is printed as a warning and the
// E2E result stays whatever the tests made it.
//
// Context (all set by the workflow):
//   E2E_SLACK_ENABLED      "1" to send at all
//   E2E_ENVIRONMENT        e.g. "Production"
//   E2E_RELEASE_SHA        the deployed commit
//   E2E_DEPLOYMENT_URL     link to the successful deployment run
//   E2E_TARGET_URL         the frontend the journeys ran against
//   E2E_ARTIFACT_URL       the uploaded e2e-results artifact
//   E2E_SETUP_ERROR        set when the run never got to the journeys
//   E2E_DEPLOY_STATUS      "succeeded" (the workflow only runs after one)
//   E2E_SLACK_API_URL      Slack API base; only for testing this script against a stub
import { readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const dir = process.argv[2] ?? 'apps/console/e2e-results'
const env = process.env
const MAX_TEXT = 35_000
const MAX_FILES = 10
// Slack's own ceiling is 1 GB; anything near it should be a link, not a post.
const MAX_FILE_BYTES = 200 * 1024 * 1024

const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const link = (url, label) => (url ? `<${url}|${escape(label)}>` : escape(label))
const code = (value) => `\`${String(value ?? '').replaceAll('`', "'")}\``

const formatDuration = (ms) => {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

const warn = (message) => console.log(`::warning::Slack report: ${message}`)

let summary = null
try {
  summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))
} catch {
  // No summary: the run stopped before the journeys (deploy check, install,
  // browser download). Reported as a failure with whatever reason we have.
}

const runUrl =
  env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : ''
const attempt = Number(env.GITHUB_RUN_ATTEMPT ?? 1)
const sha = env.E2E_RELEASE_SHA || summary?.release?.sha || env.GITHUB_SHA || ''
const shortSha = sha.slice(0, 7)
const commitUrl =
  env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && sha
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/commit/${sha}`
    : ''
const artifactUrl = env.E2E_ARTIFACT_URL || runUrl
const marker = `e2e-release ${shortSha || 'unknown'}`

const status = env.E2E_SETUP_ERROR ? 'FAIL' : (summary?.status ?? 'FAIL')
const finalStatus = status === 'RUNNING' ? 'PARTIAL' : status
const emoji =
  finalStatus === 'PASS' ? ':white_check_mark:' : finalStatus === 'PARTIAL' ? ':warning:' : ':x:'
const journeys = summary?.journeys ?? []
const failed = journeys.filter((j) => j.status === 'FAIL')

/** Playwright's timeout sentences, in the words a person would use. */
function plainError(message) {
  const text = String(message ?? '').trim()
  const hook = text.match(/^"(\w+)" hook timeout of (\d+)ms exceeded/)
  if (hook) return `${code(hook[1])} hook timed out after ${Number(hook[2]) / 1000} seconds.`
  const test = text.match(/^Test timeout of (\d+)ms exceeded/)
  if (test) return `The journey timed out after ${Number(test[1]) / 1000} seconds.`
  return code(text.split('\n')[0] || 'failed')
}

/**
 * The local re-run for one journey. A live journey (`e2e/live-*.spec.ts`, which
 * is every journey a release runs) skips itself without `E2E_LIVE=1` and the
 * dedicated account, so its command carries them; the values stay `…` and the
 * docs say where they come from.
 */
function rerunCommand(journey) {
  const title = journey ? journey.name.replaceAll('`', "'").replaceAll('"', "'") : '<title>'
  const live = !journey || /(^|\/)live-[^/]*\.spec\./.test(journey.file ?? '')
  const target = env.E2E_TARGET_URL ? ` E2E_BASE_URL=${env.E2E_TARGET_URL}` : ''
  return live
    ? `E2E_LIVE=1 E2E_USER=… E2E_PASSWORD=… E2E_ENV_ID=… E2E_ENV_PREFIX=… E2E_ENVIRONMENT=…${target} pnpm --filter console test:e2e:journey "${title}"`
    : `pnpm --filter console test:e2e:journey "${title}"`
}

function message({ videosAttached }) {
  const c = summary?.counts ?? {}
  const environment = env.E2E_ENVIRONMENT || 'Production'
  const deployed = env.E2E_DEPLOY_STATUS === 'succeeded'
  const verdict =
    finalStatus === 'PASS' ? 'Passed' : finalStatus === 'PARTIAL' ? 'Incomplete' : 'Failed'
  const skipped = (c.skipped ?? 0) + (c.notRun ?? 0)
  const lines = [
    `${emoji} *${escape(environment)} E2E Verification ${verdict}*${attempt > 1 ? ` (re-run, attempt ${attempt})` : ''}`,
    `*Release:* ${shortSha ? link(commitUrl, shortSha) : code('unknown')} | *Environment:* ${escape(environment)}`,
    `*Deployment:* ${
      deployed
        ? `:white_check_mark: Successful — Live at ${env.E2E_TARGET_URL ? link(env.E2E_TARGET_URL, env.E2E_TARGET_URL) : 'the production URL'}`
        : escape(env.E2E_DEPLOY_STATUS || 'unknown')
    }${env.E2E_DEPLOYMENT_URL ? ` (${link(env.E2E_DEPLOYMENT_URL, 'deploy run')})` : ''}`,
  ]

  if (env.E2E_SETUP_ERROR) {
    lines.push(
      `*Test Results:* the journeys did not run.`,
      `*Reason:* ${escape(env.E2E_SETUP_ERROR)}`,
    )
  } else {
    lines.push(
      `*Test Results:* ${c.total ?? 0} journeys | ${c.passed ?? 0} Passed | ${c.failed ?? 0} Failed | ${skipped} Skipped${
        c.retried ? ` | ${c.retried} Retried` : ''
      } | ${escape(formatDuration(summary?.durationMs))}`,
    )
  }
  for (const problem of summary?.infrastructure ?? []) {
    lines.push(`*Infrastructure error:* ${code(problem.split('\n')[0])}`)
  }

  for (const j of failed) {
    const f = j.failure ?? {}
    lines.push('', `*Failed Journey:* ${code(j.name)}`, `*Failure:* ${plainError(f.message)}`)
    if (f.step) {
      lines.push(`*Failed at:* ${code(f.step)}`)
    } else {
      lines.push('The journey failed during setup, before its own steps could run.')
    }
    if (f.expected || f.actual) {
      lines.push(
        `*Expected:* ${code(f.expected ?? 'every step completes')} | *Actual:* ${code(f.actual ?? f.message)}`,
      )
    }
    lines.push(
      `*Likely cause (inferred):* ${f.likelyCause?.[0] ? escape(f.likelyCause[0]) : 'not yet identified.'}`,
    )
    if (j.evidence.video.length > 0) {
      lines.push(
        `*Video:* ${videosAttached.has(j.id) ? 'attached to this message' : `${link(artifactUrl, 'in the artifact')} → ${code(`journeys/${j.id}/${j.evidence.video[0]}`)}`}`,
      )
    }
  }

  if (env.E2E_SETUP_ERROR) {
    lines.push(
      '',
      '*Next Steps:*',
      '1. Fix the configuration or service named in the reason above.',
      '2. Re-run this workflow from GitHub Actions (or run it by hand with the Slack option on).',
    )
  } else if (finalStatus !== 'PASS') {
    const first = failed[0]
    lines.push(
      '',
      '*Next Steps:*',
      '1. Inspect the failure screenshot and Playwright trace in the artifact.',
      `2. Identify what is causing ${first ? (first.failure?.step ? 'the failing step' : 'the setup to fail') : 'the run to stop'}.`,
      `3. Re-run the journey locally:\n\`${rerunCommand(first)}\``,
      '   Use the dedicated E2E account, never your own: see `docs/e2e-testing.md` → Running locally.',
      '4. Fix the issue and rerun E2E verification.',
    )
    if (failed.length > 1)
      lines.push(`_${failed.length} journeys failed; each one is listed above._`)
  }

  const notRun = c.notRun ?? journeys.filter((j) => j.status === 'NOT RUN').length
  const reasons = [
    ...new Set(
      journeys.filter((j) => j.status === 'SKIPPED').map((j) => j.skipReason || 'no reason given'),
    ),
  ]
  if (notRun > 0 || reasons.length > 0) {
    const parts = []
    if (notRun > 0) {
      parts.push(
        `The remaining ${notRun} journey${notRun === 1 ? ' was' : 's were'} not executed${failed.length > 0 ? ' after the failure' : ''}.`,
      )
    }
    for (const reason of reasons) parts.push(escape(reason))
    lines.push('', `*Skipped:* ${parts.join(' ')}`)
  }

  lines.push(
    '',
    `*Artifacts:* ${link(artifactUrl || runUrl, `GitHub Actions Run #${env.GITHUB_RUN_ID ?? 'local'}`)} — includes summary, screenshots and trace.`,
  )
  if (finalStatus !== 'PASS' && deployed) {
    lines.push(
      '*Important:* Deployment is successful and production is live. No rollback was triggered. Only post-deployment E2E verification failed.',
    )
  }
  // The thread key for re-runs: `earlierReport` finds this line.
  lines.push(`_${marker} · attempt ${attempt}_`)

  let text = lines.join('\n')
  if (text.length > MAX_TEXT) {
    text = `${text.slice(0, MAX_TEXT)}\n…truncated — the full list is in ${link(artifactUrl, 'journey-inventory.md')}.`
  }
  return text
}

async function slackApi(method, token, body, { json = true } = {}) {
  const response = await fetch(`${env.E2E_SLACK_API_URL || 'https://slack.com/api'}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': json
        ? 'application/json; charset=utf-8'
        : 'application/x-www-form-urlencoded',
    },
    body: json ? JSON.stringify(body) : new URLSearchParams(body),
  })
  const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))
  if (!data.ok) {
    const hint =
      data.error === 'channel_not_found' || data.error === 'not_in_channel'
        ? " — check that E2E_SLACK_CHANNEL_ID is the channel id (C…) in the bot token's workspace and that the bot was invited to it (/invite in the channel)"
        : ''
    throw new Error(`${method}: ${data.error ?? 'unknown error'}${hint}`)
  }
  return data
}

/** On a re-run, the earlier report for this release, so the new one threads under it. */
async function earlierReport(token, channel) {
  if (attempt <= 1) return null
  try {
    const history = await slackApi(
      'conversations.history',
      token,
      { channel, limit: '100' },
      { json: false },
    )
    return history.messages?.find((m) => (m.text ?? '').includes(marker))?.ts ?? null
  } catch (error) {
    warn(`could not look for an earlier report (${error.message}); posting a new message`)
    return null
  }
}

async function viaBot(token, channel) {
  const threadTs = await earlierReport(token, channel)
  const videos = failed
    .flatMap((j) =>
      j.evidence.video.map((v) => ({ journey: j, path: join(dir, 'journeys', j.id, v) })),
    )
    .filter(({ path }) => {
      try {
        return statSync(path).size <= MAX_FILE_BYTES
      } catch {
        return false
      }
    })
    .slice(0, MAX_FILES)

  if (videos.length > 0) {
    try {
      const files = []
      for (const { journey, path } of videos) {
        const bytes = readFileSync(path)
        const filename = `${journey.id}${basename(path).slice(basename(path).lastIndexOf('.'))}`
        const { upload_url: uploadUrl, file_id: id } = await slackApi(
          'files.getUploadURLExternal',
          token,
          { filename, length: String(bytes.length) },
          { json: false },
        )
        const put = await fetch(uploadUrl, { method: 'POST', body: bytes })
        if (!put.ok) throw new Error(`upload of ${filename}: HTTP ${put.status}`)
        files.push({ id, title: `${journey.name} (${journey.id})` })
      }
      const attached = new Set(videos.map((v) => v.journey.id))
      await slackApi('files.completeUploadExternal', token, {
        files,
        channel_id: channel,
        initial_comment: message({ videosAttached: attached }),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      })
      console.log(`Posted the report with ${files.length} failed-journey video(s) attached.`)
      return
    } catch (error) {
      warn(`video upload failed (${error.message}); posting the report with artifact links instead`)
    }
  }

  await slackApi('chat.postMessage', token, {
    channel,
    text: message({ videosAttached: new Set() }),
    unfurl_links: false,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  })
  console.log('Posted the report.')
}

async function viaWebhook(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message({ videosAttached: new Set() }), unfurl_links: false }),
  })
  if (!response.ok) throw new Error(`webhook: HTTP ${response.status}`)
  console.log('Posted the report through the webhook (videos linked, not attached).')
}

try {
  const token = env.E2E_SLACK_BOT_TOKEN
  const channel = env.E2E_SLACK_CHANNEL_ID
  const webhook = env.E2E_SLACK_WEBHOOK_URL
  if (env.E2E_SLACK_ENABLED !== '1') {
    console.log(
      'Slack disabled (E2E_SLACK_ENABLED is not 1); this is the message that would be sent:\n',
    )
    console.log(message({ videosAttached: new Set() }))
  } else if (token && channel) {
    try {
      await viaBot(token, channel)
    } catch (error) {
      if (!webhook) throw error
      warn(`bot post failed (${error.message}); falling back to the webhook`)
      await viaWebhook(webhook)
    }
  } else if (webhook) {
    await viaWebhook(webhook)
  } else {
    warn('no E2E_SLACK_BOT_TOKEN + E2E_SLACK_CHANNEL_ID and no E2E_SLACK_WEBHOOK_URL; nothing sent')
    console.log(message({ videosAttached: new Set() }))
  }
} catch (error) {
  warn(error.message)
}
