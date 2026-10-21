# The API contract gap — a Phase 0, not a frontend problem

V2 makes `@flexprice/sdk` the single contract with the backend. That decision
stands. What follows is the prerequisite it exposed, and the sequencing it
implies.

**The decision: fix it upstream. Do not bake today's incomplete annotations into
V2.** The frontend should not permanently compensate for a backend contract
problem — that is how the 47 hand-written API classes and 53 DTO files got
written the first time.

## The measurement

Counting exported `gin` handlers in `flexprice/internal/api/v1/*.go` against
`// @Router` annotations in the same files:

| | |
|---|---:|
| Handlers registered as routes | **320** |
| Carrying a `@Router` annotation | **211** |
| **Absent from the OpenAPI document** | **~109 (34%)** |

An unannotated handler is a live, RBAC-protected endpoint that swaggo never
sees. It is therefore missing from the spec, from all four generated SDKs, and
from the MCP server — while working perfectly well in production, which is why
this has gone unnoticed.

## Where the gaps are

Not spread evenly. They cluster on exactly the surfaces V2 needs first:

| File | Handlers | Documented | Gap |
|---|---:|---:|---:|
| `customer_portal.go` | 25 | **0** | 25 |
| `webhook.go` | 12 | **0** | 12 |
| `connection.go` | 6 | **0** | 6 |
| `meter.go` | 6 | **0** | 6 |
| `environment.go` | 5 | 1 | 4 |
| `settings.go` | 3 | **0** | 3 |
| `auth.go` | 2 | **0** | 2 |
| `dashboard.go` | 2 | **0** | 2 |
| `onboarding.go` | 2 | **0** | 2 |
| `hosted_invoice.go` | 3 | **0** | 3 |

Three consequences, in order of severity:

1. **The customer portal cannot be built on the SDK at all.** All 25 handlers
   undocumented. This is why portal migration is Phase 4 and not Phase 2.

2. **Session bootstrap cannot go through the SDK.** `GET /environments` is a
   live route — `internal/api/router.go:193` registers it — but only
   `CloneEnvironment` is annotated, so the SDK's `environments` resource has
   exactly one method. Every call except the discovery routes needs an
   `X-Environment-ID`, and listing environments is how one gets chosen. The most
   load-bearing call in the auth flow is the one the contract does not describe.
   `auth.go` is likewise 0 of 2.

3. **The V1 dashboard is already calling undocumented endpoints.**
   `CustomerApi.getCustomers()` issues `GET /customers` with query params; the
   spec gives `/customers` only `put` and `post`. It works, and nothing told
   anyone it was outside the contract. The drift the generated layer exists to
   expose is already present.

`POST /users/chat/verify` (the support chat's identity hash, `CreateSupportChatToken`)
is another live route outside the document. The console reaches it through
`fetchSupportChatToken` in `@fp/api`, the way it reaches the revenue dashboard,
and only when `VITE_PYLON_IDENTITY_VERIFICATION_ENABLED` is on.

## Sequencing

```
Phase 0  Backend contract cleanup
         ├── auth
         ├── environment
         └── customer_portal
              ↓
Phase 1  @flexprice/sdk release
              ↓
Phase 2  V2 platform foundation
         ├── query
         ├── domain
         ├── actions
         ├── UI / ReUI
         └── architecture enforcement
              ↓
Phase 3  Dashboard migration
              ↓
Phase 4  Customer Portal migration
```

**Phase 2 does not wait on Phase 1.** The foundation packages are shaped by the
*corrected* contract, not by today's SDK build, and none of them needs an
endpoint the cleanup will add. Phases 3 and 4 are the gates that do.

All Flexprice frontends consume the same generated SDK and the same contract
conventions. The portal does not get started as "another app on whatever SDK
exists today" — that is how a second contract gets born.

## Phase 0, concretely

Adding `@Summary` / `@Param` / `@Success` / `@Router` comments to the
unannotated handlers is mechanical, carries no runtime risk, and pays out four
times from one edit: the spec, three SDKs, and the MCP server all improve — for
Flexprice's customers as much as for this repo. Order by what V2 needs:

1. `auth.go`, `environment.go` — unblocks sign-in and environment selection
2. `customer_portal.go` — unblocks the portal app entirely
3. `settings.go`, `onboarding.go`, `dashboard.go`, `meter.go`, `connection.go`
4. `webhook.go` — its 60 *event* schemas are documented; its 12 handlers are not

Then re-run the Speakeasy pipeline and publish.

**Also fold in two fixes while the annotations are being written:**

- **`types.Duration` is both an object and an enum.** It carries
  `properties: { unit, value }` *and* `enum: ["3600000000000"]` — the Go
  constant `EntitlementGrantMinDuration` leaking onto the type that holds it. A
  schema cannot be both. Speakeasy tolerates it; strict OpenAPI tooling rejects
  the document outright (`Expected SchemaObject, received string`).

- **`.speakeasy/overlays/typescript-auth.yaml` is not in the published build.**
  The overlay declaring `BearerAuth` (JWT) and `EnvironmentId` already exists in
  the backend repo, but `@flexprice/sdk@2.1.30` still types its security as
  `{ apiKeyAuth: string }` — the one credential that must never reach a browser.
  Until the overlay ships, `@fp/api` injects both headers through an
  `HTTPClient` `beforeRequest` hook and never populates `security`. When it
  lands, that hook becomes the SDK's own typed option and the workaround goes.

## If Phase 0 slips

V2 still proceeds. The mismatch is isolated in exactly one place —
`packages/sdk-adapter` — rather than spread through the portal or the query
layer. That package:

- requires every shim to name its endpoint, its reason, and a **removal issue**,
  validated by `shims.test.ts` against `owner/repo#123`
- is imported by `@fp/query` only, never by an app or a component
- fails its own test suite if it grows past 5 entries — a tripwire, not a cap
- **is deleted when it reaches zero**

It currently holds **zero shims**, and the foundation does not depend on one.

The hosted invoice page's three `/public/v1` routes (`hosted_invoice.go`: view,
download, pay) are called with plain `fetch` from `packages/api/src/hostedInvoice.ts`.
That is by design, not a gap: public routes authenticate with the link's token, not a
session or API key, and will not be added to the SDK. The customer portal and checkout
follow the same rule.
