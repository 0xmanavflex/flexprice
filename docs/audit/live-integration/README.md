# The console against the real backend

Captured with Playwright against a dev server pointed at
`https://api.cloud.flexprice.io/v1` with `VITE_USE_MOCKS=false` — no MSW, no
fixtures. Reproduce with the live e2e recipe in `apps/console/e2e/README.md`.

`api-calls.json` is every request that actually left the browser during the
first pass: method, path, HTTP status, and whether `Authorization` and
`X-Environment-ID` were on it. 35 calls, all 200, and every environment-scoped
call carrying the header — which is the claim these screenshots exist to
support.

| Shot | What it proves |
| --- | --- |
| `01-sign-in.png` | The sign-in screen **before** the ReUI `auth-6` layout — kept as the before half of the pair. |
| `03-signed-in-home.png` | A real session: the test account, tenant `testing`, from `GET /users/me`. |
| `04-environment-switcher.png` | The two environments the tenant actually has, from `GET /environments`. |
| `05-plans.png` | Real rows. Note the sidebar counts (Features 3, Plans 1) and `2 charges`, which needs `expand: prices` to be honoured. |
| `06-features.png` | Real features, and the one surface whose `nameContains` search the API supports natively. |
| `07-customers.png` | Real customers. |
| `08-subscriptions.png` | The customer column reads a **name**, not a ULID — the `expand: 'customer,plan'` fix. |
| `09-plans-search-no-match.png` | Searching `zzzznomatch` returns nothing. Before the filter-DSL fix this returned every row, because the SDK stripped the undeclared key. |
| `10-sign-in-auth6.png` | The sign-in screen **after**, on the ReUI `auth-6` split layout. |
| `11-sign-in-auth6-dark.png` | The same in dark mode. |
| `12-sign-in-rejected.png` | A real `403` from the live API: one sentence, email kept, password cleared and focused. The backend's own "Failed to get user" is deliberately not shown. |
| `13-plans-after-auth6-signin.png` | Real rows reached by signing in through the new screen. |

The environment shown is **Sandbox**. The console opens on `Tejas`, which is
empty — which environment you land in is a per-tenant accident, and the reason
the live e2e spec makes you name one.
