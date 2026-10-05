# CI

Eight workflows, each answering one question, so a red check names the problem
before you open it.

| Workflow | Gates | Roughly |
| --- | --- | --- |
| `lint.yml` | ESLint and TypeScript across every package | 2–4 min |
| `test.yml` | Unit tests — domain, query, URL codecs, fixtures | 2–3 min |
| `storybook.yml` | Every story as a browser test, **plus accessibility**; and the static workbench build | 8–12 min |
| `e2e.yml` | Playwright journeys against a mock-backed console | 5–10 min |
| `visual.yml` | Screenshot regression: every route against its committed baseline | 5–10 min |
| `build.yml` | The production bundle, and its size in the summary | 2–4 min |
| `sast.yml` | Semgrep. Soft-fail in phase 1 | 2–5 min |
| `deploy.yml` | Vercel. **Skips until its secrets exist** | — |

They were split rather than left as one job because the failures have different
owners. A failing lint and a failing accessibility check are not the same
problem, and one combined red check makes you open the run to find out which
you have.

## Accessibility is a gate, not a report

`.storybook/preview.ts` sets `a11y: { test: 'error' }`, so an axe violation
fails `storybook.yml`. That is why a contrast regression on 12px text is caught
here rather than in review — it has happened, more than once.

## Formatting is not a gate yet

`lint.yml` reports the count and does not fail. 367 files are unformatted and
there is no `.prettierignore`, so a repo-wide check fails on vendored
primitives and generated fixtures — reasons unrelated to any change. Format the
repo, add the ignore file, then drop the `|| true` in that step.

## Deploying

`deploy.yml` does nothing until these exist at **Settings → Secrets and
variables → Actions**:

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Team Settings → General ("Team ID") |
| `VERCEL_PROJECT_ID` | Vercel → the project → Settings → General |

Optional: `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Project → Settings →
Deployment Protection), needed only if previews are protected and you want
automation to reach them.

Until then the job **skips with a warning** rather than failing. A missing
secret says nothing about the change under review, and a red check the author
cannot act on is worse than no check at all.

Application config — every `VITE_*` variable — belongs in the Vercel project's
own Environment Variables, not here. `vercel pull` fetches it at build time so
the bundle is built with exactly what Vercel would use.

## What to do once it deploys

Point the journeys at the preview instead of a locally served copy:
set `E2E_BASE_URL` to the deployment URL in `e2e.yml`. A suite that boots its
own copy of the bundle cannot catch a broken build output, a bad rewrite rule
or a missing environment variable — which is the whole reason that layer
exists. Watchtower's CI already works this way and is the model.

## Branch protection

Require these checks: `ESLint and types`, `Unit`, `Stories (browser + a11y)`,
`Journeys`, `Production bundle`. Leave `Semgrep` and `Vercel` advisory while
they are soft-failing and unconfigured respectively.
