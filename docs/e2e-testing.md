# E2E testing: release verification, reports and Slack

The journey inventory: every journey, what it does and its last recorded result: is
[`docs/e2e-journeys.md`](e2e-journeys.md). This page is how the suite runs.

## Two suites, two triggers

|                   | Mocked journeys                                                                                            | Live journeys (release verification)                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Specs             | `apps/console/e2e/*.spec.ts` except `live-*`                                                               | `apps/console/e2e/live-*.spec.ts`                         |
| System under test | the console built with `VITE_USE_MOCKS=true` (MSW fixtures), served by the runner                          | the **deployed production frontend** and its API          |
| Workflow          | `.github/workflows/e2e.yml`                                                                                | `.github/workflows/e2e-release.yml`                       |
| Runs on           | pull requests, pushes to `develop` / `feat/v2-foundation` / `ci/**`, and Pipeline's Verify stage on `main` | **only** after Pipeline has deployed `main` to production |
| Slack             | never                                                                                                      | one report per release                                    |

The mocked suite is the existing CI check and is unchanged in when it runs; it tests the
application, not a deployment, and posts nothing. Everything below is about the live,
release-triggered suite unless it says otherwise.

## When the release verification runs

```
push to main
  → Pipeline: Check (lint, unit, build) → Deploy (Deploy main = deploy.yml `vercel deploy --prod`, regions) → Verify (mocked suites)
  → Pipeline completes
  → E2E release verification (workflow_run on Pipeline, branch main)
       1. reads that Pipeline run's jobs: continues only if the "Deploy main" job
          succeeded AND its "Deploy" step concluded success (not skipped)
       2. polls <E2E_BASE_URL>/meta.json until it serves the released commit
          (every build publishes its commit there: apps/console/app-version.ts)
       3. checks the API at E2E_API_URL answers
       4. runs the live journeys against production, one at a time
       5. uploads e2e-results (always)
       6. posts one Slack report (always, never fails the job)
```

What does **not** start it: a pull request, a push to any branch (including `main` on its
own), a build or lint finishing, `deploy.yml` running for a preview or a branch, a Pipeline
run whose deploy failed, was skipped (no Vercel secrets) or was cancelled by a newer push.

It cannot affect a release. Pipeline has already finished when it starts, nothing in
Pipeline `needs:` it, and it never calls or re-runs a deploy, so a failure can only fail
_this_ workflow. Pipeline's own conclusion is deliberately not used as the signal: its last
stage (mocked suites) runs after the deploy, so it can go red while the release is live.

Concurrency is one run per released commit (`e2e-release-<sha>`, queued, not cancelled), so
a re-run never races the first on the shared test account.

## GitHub configuration

Settings → Secrets and variables → Actions.

| Name                    | Kind     | Required    | What                                                                                                                                               |
| ----------------------- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`          | Variable | yes         | Production frontend users receive, e.g. `https://admin.flexprice.io`                                                                               |
| `E2E_API_URL`           | Variable | yes         | The API that frontend talks to; checked before the run, and used by local live runs                                                                |
| `E2E_ENV_ID`            | Variable | yes         | Id of the dedicated environment the journeys may write to                                                                                          |
| `E2E_ENV_PREFIX`        | Variable | recommended | That environment's name prefix (isolation guard). Default `claude-e2e-forms-`                                                                      |
| `E2E_ENVIRONMENT`       | Variable | optional    | Environment whose rows the read-only catalogue journey asserts on; that journey is SKIPPED without it                                              |
| `E2E_RETRIES`           | Variable | optional    | Retries per journey, default `0` (see Retries)                                                                                                     |
| `E2E_SLACK_CHANNEL_ID`  | Variable | for videos  | Channel id (`C…`) for the bot-token report                                                                                                         |
| `E2E_USER`              | Secret   | yes         | The dedicated E2E account's email: never a person's                                                                                               |
| `E2E_PASSWORD`          | Secret   | yes         | Its password                                                                                                                                       |
| `E2E_SLACK_WEBHOOK_URL` | Secret   | yes*        | Incoming webhook for the report. *Either this or the bot token                                                                                     |
| `E2E_SLACK_BOT_TOKEN`   | Secret   | for videos  | Bot token (`xoxb-…`) with `chat:write`, `files:write`, `channels:history` (`groups:history` for a private channel); the bot must be in the channel |

An incoming webhook cannot upload files. With only the webhook, the report is posted with a
link to the artifact where each failed journey's video is. With the bot token and channel,
the videos are uploaded through Slack's external-upload API and shared as the same message
as the report.

The test account must be dedicated to E2E: its tenant may be shared, but every write goes to
`E2E_ENV_ID` only: the live specs abort if the console is in any other environment and
block any non-GET request carrying a different `X-Environment-ID`.

## Reports

Every run writes `apps/console/e2e-results/` (`e2e/reporters/journey-reporter.ts`), and the
workflow uploads it as the `e2e-results-<sha>-<attempt>` artifact (30 days; 14 for the
mocked suite):

```
e2e-results/
  summary.json            status, counts, durations, release, every journey, infra errors
  journey-inventory.md    the same as a table
  journeys/<journey-id>/
    summary.md            status, duration, steps, expected vs actual, failing step, stack,
                          evidence links, likely cause (marked inferred)
    meta.json
    screenshots/ video/ trace/ logs/     ← only when the journey's final result is FAIL
```

- A journey's report is written the moment it finishes, and `summary.json` is rewritten after
  every journey, so a run that is interrupted or times out keeps everything that completed.
  Journeys that never ran are listed as `NOT RUN` and the run as `PARTIAL`.
- `logs/` holds the browser console errors, failed / 4xx / 5xx requests (method, path and
  status only: no headers, bodies or query strings), the test's stdout and the full error.

### Videos and evidence only for failures

Playwright records every journey (`video: 'retain-on-failure'`, trace and screenshot likewise)
and discards the recording when the attempt passes. The reporter then applies the final
result: a journey that ends PASS has every earlier failed attempt's files deleted too, and
nothing is copied into `e2e-results`; a journey that ends FAIL gets its final attempt's video,
screenshots, trace and logs. Verified: a fail-then-pass journey leaves no video, and a
fail-fail journey keeps exactly one.

### Retries

`retries` is `0` (`e2e/AGENTS.md`: a flaky test is a broken test). `E2E_RETRIES` can raise it
for the release run. The final attempt is authoritative; earlier failed attempts are recorded
in the report and `summary.json` (`attempts`, `retries`, the `Retried` count) and a pass after
a retry is called out as a finding.

### No secrets in evidence

- Credentials come only from the environment; nothing is hardcoded, and `E2E_EMAIL` is still
  read as an older name for `E2E_USER`.
- Every text the reporter writes is redacted: the exact values of `E2E_PASSWORD`, `E2E_USER`
  and the Slack secrets, and anything shaped like a bearer token, JWT, cookie, API key or
  Slack webhook/token.
- Traces record action arguments, request headers and storage, so each trace is unzipped,
  redacted entry by entry and re-zipped; if that fails the trace is withheld.
- The live journeys sign in once, in `beforeAll`, outside any journey's recording; each
  journey starts from saved storage state (a temp file, deleted afterwards).
- Screenshots and videos show the screen: the password field is always masked, but the
  sign-in journeys in `live-auth.spec.ts` type the account email visibly, so a failure there
  can show `E2E_USER` in its recording. No token, cookie or webhook is ever on screen.
- Only `e2e-results/` is uploaded by the release workflow: never `test-results/` or the HTML
  report, which hold raw traces.

## The Slack report

`.github/scripts/e2e-release-slack.mjs` posts exactly one message per release-triggered run, in
this order: the verdict (Passed / Failed / Incomplete), release and environment, the deployment
(and that it is live), one line of results (`12 journeys | 1 Passed | 1 Failed | 10 Skipped`),
then for each failed journey its name, the failure in plain words (a hook or test timeout reads
as "timed out after N seconds"), the failing step or "failed during setup", expected and actual
when known, the likely cause, and its video. A failure adds numbered next steps with the local
re-run command, a "Skipped" line (journeys not executed after the failure, and each skip reason),
the artifact link, and, when the deploy succeeded, that nothing was rolled back. If the run never
reached the journeys (missing configuration, production never served the release, API down) the
report is a failure with that reason and steps to fix it.

- **Re-runs**: with the bot token, a re-run of a release already reported is posted as a reply
  in that release's thread, not as a new message. With only the webhook a re-run posts a new
  message, labelled "re-run, attempt N".
- **Failures to post** only warn; they never change the job's result or remove the artifact.
- Videos over 200 MB, more than 10 videos, or any upload error fall back to the artifact link.
- **`channel_not_found` / `not_in_channel`**: the bot cannot see `E2E_SLACK_CHANNEL_ID`. The id must be
  the channel's `C…` id in the bot token's workspace, and the bot must be invited to the channel
  (`/invite @<bot>`). Until then the report goes out through the webhook, without videos.

## Running locally

From `apps/console`. Locally nothing is ever posted to Slack (the sender only sends with
`E2E_SLACK_ENABLED=1`, which only the release workflow sets).

```bash
pnpm test:e2e                       # every mocked journey
pnpm test:e2e:report                # the same, with e2e-results/ written
pnpm test:e2e:journey "creates a customer"           # one journey (title match)
pnpm test:e2e:journey "@journey"                     # a group, by tag
pnpm test:e2e:report e2e/customers.spec.ts e2e/invoice-edit.spec.ts   # a group, by file
E2E_PORT=3310 pnpm test:e2e         # when something else already holds :3000
```

Live journeys, with the dedicated account (never your own): against a deployed frontend:

```bash
E2E_USER=… E2E_PASSWORD=… E2E_ENV_ID=… E2E_ENV_PREFIX=… E2E_ENVIRONMENT=… \
E2E_BASE_URL=https://admin.flexprice.io pnpm test:e2e:live
```

or against a local console pointed at the API (no `E2E_BASE_URL`; the dev server is started
with `VITE_USE_MOCKS=false` and `VITE_FLEXPRICE_API_URL=$E2E_API_URL`):

```bash
E2E_USER=… E2E_PASSWORD=… E2E_ENV_ID=… E2E_API_URL=https://api… pnpm test:e2e:live
```

To preview the Slack message for any local run:
`node .github/scripts/e2e-release-slack.mjs apps/console/e2e-results`. To regenerate the
inventory with real results: `node scripts/e2e-journey-inventory.mjs apps/console/e2e-results/summary.json`.

Manually in CI: Actions → **E2E release verification** → Run workflow, optionally with a
journey filter, and with "Post the report to Slack" off by default.
