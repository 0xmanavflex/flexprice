# CI

Thirteen workflows, each answering one question, so a red check names the problem
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
| `storybook-deploy.yml` | Publishes Storybook to its own Vercel project. **Skips until its secrets exist** | 4–8 min |
| `deploy-develop.yml` | Deploys the `develop` branch to its own Vercel project. **Skips until `VERCEL_DEVELOP_PROJECT_ID` exists** | — |
| `deploy-regions.yml` | Deploys `main` to the India and Canada console projects. **Each region skips until its project ID secret exists** | 4–8 min |
| `sdk-watch.yml` | Weekly: is a newer `@flexprice/sdk` out, or does the backend spec have operations or fields the installed one lacks? Opens one `sdk-update` issue. Dependabot opens the upgrade PR | 1–2 min |
| `storybook-deploy-develop.yml` | Publishes the `develop` branch's Storybook to its own Vercel project. **Skips until `VERCEL_STORYBOOK_DEVELOP_PROJECT_ID` exists** | 4–8 min |

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

## Deploying Storybook

`storybook-deploy.yml` publishes the workbench to a **second Vercel project**, so it has its own URL, protection and history. It builds Storybook in the runner and uploads the finished static site (Vercel's Build Output API), so none of the Vercel project's build settings matter and the console's root `vercel.json` is never read. A push to `main` is production; a pull request gets a preview and a comment with its URL.

1. In Vercel, create an empty project (framework **Other**, no Git connection needed) and copy its **Project ID**.
2. Add the repository secrets below. `VERCEL_TOKEN` and `VERCEL_ORG_ID` are the same values `deploy.yml` uses.

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens (shared) |
| `VERCEL_ORG_ID` | Vercel → Team Settings → General ("Team ID") (shared) |
| `VERCEL_STORYBOOK_PROJECT_ID` | Vercel → the Storybook project → Settings → General |

3. Optional: turn on Deployment Protection (Vercel SSO) and attach a custom domain in the Storybook project.

No application variables are needed — Storybook runs on fixtures. Until the secrets exist the job skips with a warning. The build first checks that `packages/ui/src/design-system/anatomy.generated.json` is current; after adding, removing or moving a component, page or story, run `pnpm ui:anatomy` and commit the result.

## What to do once it deploys

Point the journeys at the preview instead of a locally served copy:
set `E2E_BASE_URL` to the deployment URL in `e2e.yml`. A suite that boots its
own copy of the bundle cannot catch a broken build output, a bad rewrite rule
or a missing environment variable — which is the whole reason that layer
exists. Watchtower's CI already works this way and is the model.

## Journey results in Slack

After the journeys run on a push to `main` (after the deploys, through
`pipeline.yml`) or to `develop`, `e2e.yml` posts one message to Slack: "these
journeys passed" or "a journey failed", the failing tests by name, every
`@journey` test with its result, the commit, and a link to the run. It is built
from Playwright's JSON report by `.github/scripts/e2e-slack-summary.mjs`.

| Secret | Where to find it |
| --- | --- |
| `SLACK_E2E_WEBHOOK_URL` | Slack → api.slack.com/apps → your app → Incoming Webhooks → Add New Webhook to Workspace → pick the channel → copy the URL |

Without the secret the step logs a line and exits 0. Pull request runs never
post, and a failed post only warns.

To preview a message locally, run the script against any JSON report:
`node .github/scripts/e2e-slack-summary.mjs apps/console/playwright-results.json`.

## Branch protection

Require these checks: `ESLint and types`, `Unit`, `Stories (browser + a11y)`,
`Journeys`, `Production bundle`. Leave `Semgrep` and `Vercel` advisory while
they are soft-failing and unconfigured respectively.

## The `develop` branch

Every check above also runs on pushes to `develop` (and on pull requests into it). `deploy-develop.yml` publishes each push to `develop` as that Vercel project's production deployment.

1. In Vercel, create a project for the develop environment and copy its **Project ID**.
2. Add the repository secret `VERCEL_DEVELOP_PROJECT_ID`. `VERCEL_TOKEN` and `VERCEL_ORG_ID` are the ones `deploy.yml` already uses.
3. Set the develop project's own Environment Variables (every `VITE_*`), so it points at the develop API.

`storybook-deploy-develop.yml` publishes `develop`'s Storybook to a separate Vercel project (empty, framework **Other**) whose ID goes in `VERCEL_STORYBOOK_DEVELOP_PROJECT_ID`. The production Storybook (`storybook-deploy.yml`) deploys from `main` only.

## Regions: India and Canada

`deploy-regions.yml` deploys every push to `main` to a Vercel project per region. The code is the same everywhere; a region is its project's Environment Variables (`VITE_FLEXPRICE_API_URL` and the other `VITE_*`), so set those in each project.

1. In Vercel, create a project for each region and copy its **Project ID**.
2. Add the repository secrets `VERCEL_INDIA_PROJECT_ID` and `VERCEL_CANADA_PROJECT_ID`. `VERCEL_TOKEN` and `VERCEL_ORG_ID` are the ones `deploy.yml` already uses.
3. A region without its secret is skipped with a warning; the other still deploys. Run the workflow by hand to redeploy one region.
