# Running the end-to-end suite

Conventions for writing these tests live in [`AGENTS.md`](./AGENTS.md); the
strategy they serve lives in [`docs/testing-strategy.md`](../../../docs/testing-strategy.md).
This file is only about how to run them.

## The default suite — mocked, hermetic, no account

```sh
pnpm --filter console test:e2e
```

Playwright starts the app itself with `VITE_USE_MOCKS=true`, so MSW serves the
captured fixture corpus and no request reaches a backend. There is no network
dependency, no shared account and nothing to configure. This is the suite that
gates a merge.

`auth.spec.ts` asserts the deliberate consequence of that: **the mocked console
needs no sign-in**. Every other spec, every Storybook story and every
`pnpm --filter console dev` depends on it.

### A clean dev server

`reuseExistingServer` is on outside CI, so Playwright will happily adopt
whatever is already listening on `:3000`. A long-lived dev server accumulates
stale HMR state and starts serving a blank `#root` with a bogus
`SyntaxError: … does not provide an export named 'X'` — the export exists, and
typecheck and build both pass. Every test then fails for a reason that has
nothing to do with the tests.

Before a run that matters, take the port back:

```sh
pkill -f "flexprice-console/apps/console/node_modules/.bin/../vite"
ss -ltnp | grep :3000   # expect nothing
pnpm --filter console test:e2e
```

Kill only this checkout's vite — other people's dev servers share the machine.
Killing a background job kills the `pnpm` wrapper but **not** the child `vite`,
so re-check the port rather than assuming.

## The live suite — opt-in, real API, real credentials

`live-auth.spec.ts` signs in against a real Flexprice backend and asserts that
real rows come back. It is **skipped unless asked for**, because a suite that
gates a merge must not depend on a network, a shared account or someone else's
data.

It needs the app pointed at the real API, which the config's own `webServer`
cannot be (it is started with `VITE_USE_MOCKS=true`). So start a dev server
yourself and hand the suite its URL — setting `E2E_BASE_URL` makes Playwright
skip starting a server of its own:

```sh
# terminal 1 — a dev server pointed at the real API
VITE_USE_MOCKS=false \
VITE_FLEXPRICE_API_URL=https://api.cloud.flexprice.io/v1 \
  pnpm --filter console dev

# terminal 2 — the live spec, and only it
E2E_LIVE=1 \
E2E_EMAIL='you@example.com' \
E2E_PASSWORD='…' \
E2E_ENVIRONMENT='Sandbox' \
E2E_BASE_URL=http://localhost:3000 \
  pnpm --filter console test:e2e live-auth
```

| Variable          | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `E2E_LIVE`        | `1` opts in. Anything else skips the spec.                       |
| `E2E_EMAIL`       | The account to sign in as.                                       |
| `E2E_PASSWORD`    | Its password. Read from the environment, never committed.        |
| `E2E_ENVIRONMENT` | The environment holding the rows to assert on. See below.        |
| `E2E_BASE_URL`    | The already-running app. Also suppresses Playwright's server.    |

### Why the environment has to be named

The console opens in whichever environment the API lists first — V1 takes
`data[0]`, V2 takes the first non-production one, and on a tenant whose
environments are all `development` those are the same coin flip. That
environment may be empty while a sibling holds every plan, which is what the
shared test account looks like today: it opens on `Tejas` and the data is in
`Sandbox`.

So the catalogue test **skips without `E2E_ENVIRONMENT`** rather than defaulting.
A default would bake one tenant's layout into the suite, and a green run would
only mean someone's first environment happened to have rows in it.

Omit any of the first three and the spec skips with a message saying so — a
missing credential is not a failing test.

**The password is never written into a file here.** A credential in a committed
file is a credential in every clone, every fork and every CI log that echoes its
environment, and rotating it means finding everyone who pulled.

## Against a deployment

The same mocked-suite journeys are written against promises a real deployment
keeps too, so they carry over unchanged:

```sh
E2E_BASE_URL=https://console.example.com pnpm --filter console test:e2e
```

Playwright starts no server and points at that URL instead.
