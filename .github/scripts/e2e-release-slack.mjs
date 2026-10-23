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

function message({ videosAttached }) {
  const c = summary?.counts ?? {}
  const lines = [
    `${emoji} *E2E Release Verification — ${finalStatus}*${attempt > 1 ? ` (re-run, attempt ${attempt})` : ''}`,
    '',
    `*Release:* ${shortSha ? link(commitUrl, shortSha) : code('unknown')}`,
    `*Environment:* ${code(env.E2E_ENVIRONMENT || 'Production')}`,
    `*Deployment:* ${env.E2E_DEPLOY_STATUS === 'succeeded' ? 'succeeded' : escape(env.E2E_DEPLOY_STATUS || 'unknown')} — ${link(env.E2E_DEPLOYMENT_URL, 'deployment run')}`,
    `*E2E Run:* ${link(runUrl, 'GitHub Actions run')}`,
    `*Target:* ${env.E2E_TARGET_URL ? link(env.E2E_TARGET_URL, env.E2E_TARGET_URL) : code('unknown')}`,
    `*Timestamp:* ${code(summary?.startedAt ?? new Date().toISOString())}`,
    `*Duration:* ${code(formatDuration(summary?.durationMs))}`,
  ]
  if (finalStatus !== 'PASS' && env.E2E_DEPLOY_STATUS === 'succeeded') {
    lines.push(
      '',
      '_The deployment succeeded and is live; the post-deployment E2E verification did not pass. Nothing was rolled back._',
    )
  }
  if (env.E2E_SETUP_ERROR) {
    lines.push('', `*The journeys did not run:* ${escape(env.E2E_SETUP_ERROR)}`)
  }
  for (const problem of summary?.infrastructure ?? []) {
    lines.push(`*Infrastructure error:* ${code(problem.split('\n')[0])}`)
  }

  lines.push(
    '',
    '*Overall Summary*',
    `• Total journeys: ${code(c.total ?? 0)}`,
    `• Passed: ${code(c.passed ?? 0)}`,
    `• Failed: ${code(c.failed ?? 0)}`,
    `• Skipped: ${code(c.skipped ?? 0)}`,
    `• Retried: ${code(c.retried ?? 0)}`,
  )
  if (c.notRun) lines.push(`• Not run (interrupted): ${code(c.notRun)}`)

  if (journeys.length > 0) {
    lines.push('', '*Journey Results*')
    for (const j of journeys) {
      if (j.status === 'SKIPPED') {
        lines.push(
          `• ${code('[SKIPPED]')} ${escape(j.name)} — ${escape(j.skipReason || 'no reason given')}`,
        )
        continue
      }
      if (j.status === 'NOT RUN') {
        lines.push(`• ${code('[NOT RUN]')} ${escape(j.name)}`)
        continue
      }
      const retried =
        j.retries > 0 ? ` (after ${j.retries} retr${j.retries === 1 ? 'y' : 'ies'})` : ''
      lines.push(
        `• ${code(`[${j.status}]`)} ${escape(j.name)} — ${code(formatDuration(j.durationMs))}${retried}`,
      )
      if (j.status === 'FAIL' && j.failure) {
        const f = j.failure
        const evidence = [j.report, ...j.evidence.screenshots, ...j.evidence.trace].map((p) =>
          p.startsWith('journeys/') ? p : `journeys/${j.id}/${p}`,
        )
        lines.push(
          `    ◦ Failed at: ${code(f.step ?? 'a hook or fixture')}`,
          `    ◦ Expected: ${code(f.expected ?? 'every step completes')}`,
          `    ◦ Actual: ${code(f.actual ?? f.message)}`,
          `    ◦ Error: ${code(f.message)}`,
          `    ◦ Evidence: ${link(artifactUrl, 'artifact')} → ${evidence.map(code).join(', ')}`,
          `    ◦ Video: ${
            j.evidence.video.length === 0
              ? 'none captured'
              : videosAttached.has(j.id)
                ? 'attached to this message'
                : `${link(artifactUrl, 'artifact')} → ${code(`journeys/${j.id}/${j.evidence.video[0]}`)}`
          }`,
        )
      }
    }
  }

  lines.push(
    '',
    '*Reports and Artifacts*',
    `• Journey inventory: ${link(artifactUrl, 'e2e-results')} → ${code('journey-inventory.md')}`,
    `• Overall summary: ${link(artifactUrl, 'e2e-results')} → ${code('summary.json')}`,
    `• Individual journey reports: ${link(artifactUrl, 'e2e-results')} → ${code('journeys/<id>/summary.md')}`,
    `• Failure screenshots and traces: ${failed.length > 0 ? `${link(artifactUrl, 'e2e-results')} → ${code('journeys/<id>/screenshots|trace')}` : 'none — nothing failed'}`,
    '',
    '*Failed Journey Videos*',
  )
  if (failed.length === 0) {
    lines.push('No failed journeys; no videos generated.')
  } else {
    for (const j of failed) {
      lines.push(
        `• ${escape(j.name)} (${code(j.id)}): ${
          videosAttached.has(j.id)
            ? 'attached'
            : j.evidence.video.length > 0
              ? link(artifactUrl, 'download from the artifact')
              : 'no recording captured'
        }`,
      )
    }
    const top = failed
      .slice(0, 3)
      .map((j) => `${escape(j.name)} — ${escape(j.failure?.message ?? 'failed')}`)
      .join('; ')
    lines.push(
      '',
      `*Most important:* ${top}${failed.length > 3 ? `; and ${failed.length - 3} more` : ''}.`,
      '*Next:* open each failed journey’s `summary.md`, then its trace from the failing step backwards; re-run one locally with `pnpm --filter console test:e2e:journey "<title>"`.',
    )
  }
  lines.push('', `_${marker} · run ${env.GITHUB_RUN_ID ?? 'local'} · attempt ${attempt}_`)

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
  if (!data.ok) throw new Error(`${method}: ${data.error ?? 'unknown error'}`)
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
