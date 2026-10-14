# Configurable authentication — plan

> Status: proposal. Written 2026-10-14 against `flexprice/flexprice@96f73a5`,
> `flexprice-front@35bf5114` and this repo at `95a43b6`.

## The one idea

**The server already knows which authentication provider it runs. The browser
should ask it, not be told at build time.**

Every problem below is a consequence of V1 encoding a server-side fact
(`cfg.Auth.Provider`, chosen in `internal/config/config.yaml`) as a build-time
browser constant (`VITE_APP_ENV`, `VITE_AUTH_PROVIDER`). That is why V1 ships two
knobs that do nothing, why a self-hosted customer cannot run the cloud's bundle,
and why nobody noticed that hosted sessions expire 720× sooner than self-hosted
ones.

The backend is already shaped correctly for this. `internal/auth/provider.go:61`
defines a `Provider` interface and `NewProvider(cfg)` dispatches on
`cfg.Auth.Provider` across `flexprice` / `supabase` / `saml`. `POST /v1/auth/login`
is public and provider-agnostic — it works identically on all three. The console
should mirror that interface, not re-derive it from env vars.

---

## 1. What is actually wrong

Established by reading all three repos; evidence inline.

### 1.1 The session expiry gap — the real bug

| Deployment | Provider | Token TTL | Refresh |
| --- | --- | --- | --- |
| Self-hosted (default) | `flexprice` | **30 days** (`internal/auth/flexprice.go:138`) | not needed |
| Cloud (dev + prod) | `supabase` | **~1 hour** (GoTrue default) | **impossible today** |

`supabaseAuth.Login` (`internal/auth/supabase.go:90-105`) receives
`AuthenticatedDetails` — which carries `RefreshToken`, `ExpiresIn` and `TokenType`
(`nedpals/supabase-go@v0.5.0/auth.go:69-74`) — and returns **only**
`user.AccessToken`. The refresh token is discarded at the provider boundary, so
`dto.AuthResponse` (`internal/api/dto/auth.go:21-25`) is `{token, user_id,
tenant_id}` and there is nothing for a client to refresh with.

Consequence in this console: `main.tsx:96-101` correctly signs the user out on a
401, so against the cloud API the console logs people out roughly **every hour,
mid-work**. V1 does not, because on hosted deployments V1 never calls
`/auth/login` at all — it uses browser-side supabase-js, which refreshes silently.

This is why the bug is invisible in development: anyone testing against a local
`flexprice`-provider backend has a 30-day session and sees nothing.

### 1.2 The console has no auth configuration at all

`apps/console/src/env.ts` reads four variables — `VITE_FLEXPRICE_API_URL`,
`VITE_USE_MOCKS`, `VITE_FLEXPRICE_API_KEY`, `VITE_LEGACY_CONSOLE_URL`. There is no
provider, no SSO tenant, no region, no branding, no feature gating.

It implements exactly one path, which happens to be V1's *self-hosted* path:
`POST /auth/login` (`packages/api/src/session.ts:125`) →
`localStorage['flexprice.session']` (`app/session/storage.ts:17`).

That path is correct and works against hosted — `docs/audit/live-integration/`
proves real 200s and a real 403 from `api.cloud.flexprice.io`. **Nothing here needs
to be thrown away.** What is missing is everything around it.

### 1.3 Surfaces that exist but are not reachable

| Surface | What exists | What is missing |
| --- | --- | --- |
| Forgot password | `ui/pages/auth/ForgotPasswordForm.tsx` + stories; `SignInForm.tsx:43` accepts `onForgotPassword` | no route, no hook, no API fn; `SignInPage` never passes the prop, so no link renders |
| Accept invitation | `ui/pages/auth/AcceptInvitationForm.tsx` + stories; `MembersPanel` can send invites | no route — the invitee has nowhere to land |
| Sign up | `signUp()` in `packages/api/src/session.ts:137`, unit-tested | no hook, no route, no screen |
| SAML sign-in | `useSamlConfig` reads the setting (`query/settings.ts:887`) | no button, no `?sso=`, no callback route |
| Google / SSO buttons | rendered at `ui/pages/auth/SignInScreen.tsx:46-49` | `onProvider` is optional and never passed — both buttons print "isn't enabled for this workspace yet" |

`docs/v1-v2-gap.md:68` claims V2 "has sign-in, forgot-password and
accept-invitation". That is true of the component library, not of the application.

### 1.4 V1's config model, and why not to copy it

`src/config/config.ts` declares `config.auth = {enabled, provider, url, anonKey}`.
`grep -rn 'config\.auth' src/` returns reads of **`url` and `anonKey` only**:

- `VITE_AUTH_ENABLED` / `VITE_SUPABASE_ENABLED` — never read. Setting it to
  `false` does not disable auth.
- `VITE_AUTH_PROVIDER` (`flexprice` | `supabase`) — never read. `AUTH_PROVIDER` is
  a dead enum.

The only live switch is `config.app.env === APP_ENV.SelfHosted`. Those two dead
knobs are the fossil of exactly the mistake this plan exists to avoid: a
build-time browser claim about a server-side fact, which drifted and was never
detected because nothing could detect it.

---

## 2. Design

### 2.1 Split configuration by who actually knows the answer

The current `env.ts` is **right** and should not grow. The discipline is:

| Kind | Source | Examples | Why |
| --- | --- | --- | --- |
| **Infrastructure** | build-time `VITE_*` | which API URL, mocks on/off, dev API key, legacy console URL | The bundle cannot discover its own backend. Genuinely build-time. |
| **Capability** | runtime, from the API | which provider, is signup open, is SAML on, token TTL, is password reset available | The server owns these. Asking removes the whole class of drift bugs. |
| **Presentation** | runtime, from the API, with a build-time fallback | brand name, logo, auth page template, region list, feature flags | Per-deployment and per-tenant; serving it means one bundle for every customer. |

Everything V1 put in column 1 that belongs in column 2 is a bug waiting to happen.

### 2.2 Backend contract — three additions

This is the entire backend ask. Each is additive and non-breaking.

**(a) `GET /v1/auth/capabilities` — public, unauthenticated, cacheable**

Mounted in the public group next to login (`internal/api/router.go:144-152`).
Reports the deployment's own configuration:

```jsonc
{
  "provider": "supabase",              // cfg.Auth.Provider — already known
  "password":  { "enabled": true, "min_length": 8 },
  "signup":    { "enabled": true, "requires_email_confirmation": true },
  "password_reset": { "enabled": true },
  "saml":      { "enabled": true, "tenant_hint_required": true },
  "oauth":     { "google": false },
  "session":   { "access_token_ttl_seconds": 3600, "refresh": true }
}
```

Every field is a value the server already holds: `cfg.Auth.Provider`,
`cfg.Auth.SAML.Enabled` (the same flag that decides whether the SAML routes are
mounted at all, `router.go:160`), and the provider's own token TTL.

Leak check: this exposes only *which methods exist*, which is already observable
by probing the endpoints — V1's `SamlSignin` literally does this with a
`redirect: 'manual'` fetch against `/auth/saml/:tenant/login` and treats 404 as
"not available" (`SamlSignin.tsx:91-95`). One honest endpoint beats three probes.

> Per-tenant nuance: `config.yaml:17-26` notes that a tenant's `saml_config`
> decides its own identity provider and *whether password login is refused*. So
> `GET /auth/capabilities` answers for the **deployment**; a per-tenant answer
> needs a tenant hint and should be a later, separate addition. Do not block
> phase 1 on it.

**(b) Return the refresh material that already exists**

Extend `auth.AuthResponse` (`internal/auth/provider.go:23-32`) and
`dto.AuthResponse` (`internal/api/dto/auth.go:21`) with `refresh_token` and
`expires_at`. In `supabaseAuth.Login`, stop dropping `user.RefreshToken` /
`user.ExpiresIn`. The `flexprice` provider returns an empty refresh token and its
30-day expiry — a client that sees no refresh token simply does not schedule one.

Additive JSON fields; the existing SDK and V1 ignore them.

**(c) `POST /v1/auth/refresh` — public, provider-dispatched**

`Auth.RefreshUser(ctx, userToken, refreshToken)` already exists in the Supabase
client (`auth.go:109`), so the Supabase implementation is roughly fifteen lines.
The `flexprice` provider can re-mint from a valid token or return
`ErrPermissionDenied` — either is fine, because with a 30-day TTL no client will
call it.

Add a `Refresh` method to the `Provider` interface so this dispatches exactly like
`Login` does, rather than branching on provider in the handler.

> While in `internal/auth/supabase.go`: `ResetPasswordForEmail` (`auth.go:280`)
> and `InviteUserByEmail` (`auth.go:344`) are also already available on the
> client. Brokering those server-side is what makes §2.5's forgot-password and
> accept-invitation work on *every* provider rather than Supabase only.

### 2.3 Frontend: capabilities as a typed, fail-open value

New `packages/api/src/authCapabilities.ts`, beside `session.ts` and for the same
documented reason — it is a bootstrap call the SDK cannot make. Then
`useAuthCapabilities()` in `@fp/query`, fetched once before `/sign-in` renders and
cached for the session.

**Fail open, not closed.** If the probe fails — 404 on an older backend, a 500, a
timeout, CORS — resolve to *password-only*, the one method that exists on every
deployment past and present. This is the mirror of the rule already written into
`useSamlConfig` (`query/settings.ts:864-885`): a failed read must never be allowed
to remove a working method or to offer a broken one. It also means phase 2 ships
safely against a backend that has not yet shipped phase 1.

The capability probe must **never block sign-in**. Render the password form
immediately; let the extra methods appear when the answer arrives.

### 2.4 An `AuthStrategy` interface, mirroring the backend's `Provider`

Today `useAuthSource` reads `env.apiKey ?? session.token`
(`app/session/useAuthSource.ts:34`). Generalise the session into one interface
that page code never branches around:

```ts
interface AuthStrategy {
  id: 'password' | 'saml' | 'oauth'
  signIn(input): Promise<Session>
  refresh?(session): Promise<Session>
  restore?(): Session | null      // e.g. read a SAML callback fragment
  signOut(session): Promise<void>
}
```

- `PasswordStrategy` — what exists today; works on all three backends unchanged.
- `SamlStrategy` — redirect out, restore from the callback.
- `OAuthStrategy` — later, if Google is brokered server-side.

The strategy registry is the only place that reads capabilities. `SignInPage`
renders whatever strategies the registry offers; `SessionProvider` stores whatever
one of them returns. This keeps the symmetry with
`internal/auth/provider.go` — one interface, one dispatch point, no provider
conditionals scattered through the UI.

### 2.5 Token lifecycle

The substance of the fix. Four properties, each one a real failure if skipped:

1. **Proactive refresh.** Schedule at ~75% of `expires_at`. Refreshing on 401 only
   means every expiry costs the user a visibly failed request.
2. **Single-flight.** One shared refresh promise. Without it, a page firing eight
   parallel queries on an expired token starts eight refreshes, and whichever
   lands last wins — on a provider that rotates refresh tokens, the other seven
   are now invalid and the user is signed out anyway.
3. **Cross-tab.** `BroadcastChannel` so a refresh in one tab updates the others
   and a sign-out signs out all of them. V1 gets this free from supabase-js;
   here it must be explicit, or two tabs will fight over one rotating token.
4. **401 still ends the session — but only after a refresh attempt fails.** Keep
   `onUnauthorized` (`main.tsx:96-101`) as the terminal state, not the first
   response.

**Storage.** The access token is in `localStorage` today, which is readable by any
XSS. Two honest options:

- **(a) Keep `localStorage`.** Status quo, matches V1, zero backend work.
- **(b) Refresh token in an `httpOnly` cookie set by the backend, access token in
  memory only.** Materially better against XSS, but the console and API are on
  different origins, so it needs cookie support, CORS credentials and CSRF
  handling on the backend.

**Recommendation: ship (a) now, and put storage behind the strategy so (b) is a
swap and not a rewrite.** (b) is the right destination but it should not gate
fixing hourly logout. Flagging it as a decision rather than quietly picking.

### 2.6 Capability-gated surfaces

Each missing surface becomes "render iff capabilities say so". The components
mostly exist; the work is routes, hooks and gating.

- **Forgot password / reset** — route `/forgot-password`, pass
  `onForgotPassword` into `SignInForm`, gate on `password_reset.enabled`.
- **Accept invitation** — route `/accept-invitation`, closing the loop on invites
  `MembersPanel` can already send.
- **Sign up** — `useSignUp` over the existing `signUp()`, gated on
  `signup.enabled`. Honour `requires_email_confirmation` rather than assuming.
- **SAML** — button gated on `saml.enabled`, plus the callback route.
- **Google / SAML placeholder buttons** — stop rendering unconditionally
  (`SignInScreen.tsx:46-49`); drive `PROVIDERS` off capabilities so a button
  appears only when it works. Delete the "isn't enabled for this workspace yet"
  fallback once nothing can reach it.

**Port V1's SAML security properties verbatim.** `SamlSignin.tsx:29-61` sets a
per-tab `sso_pending` marker and a per-login nonce carried as SAML `RelayState`
and checked at the callback. That nonce is what stops a session-fixation attack —
sending someone `/auth/callback#token=<attacker's>` so their console adopts the
attacker's session. It is easy to lose in a rewrite and must not be. Keep
`sessionStorage` (per tab, cleared on close) rather than `localStorage`, for the
reason V1 documents.

---

## 3. Explicit non-goals — traps to avoid

**Do not port `VITE_AUTH_PROVIDER` or `VITE_APP_ENV=self-hosted`.** They are the
precise mistake. Both are dead code in V1 and the drift they allow is undetectable.

**Do not put supabase-js in the console.** It is tempting because V1's hosted path
does it, but this console has already proved the backend-brokered path works
against hosted. Adding the browser client back buys one thing — Google OAuth — and
costs: two token lifecycles, two storage keys, a per-deployment project URL and
anon key in the bundle, and the GoTrue redirect-allowlist burden V1 documents at
length in `.env.example` and `utils/auth/authRedirect.ts` (a missing origin is not
an error — GoTrue silently substitutes Site URL, so it surfaces only as an email
link pointing at the wrong host). Broker Google server-side instead, in the same
shape as SAML.

**Do not let the capabilities probe gate sign-in.** Password-only is the correct
fallback for every failure mode.

**Do not ship the API-key bypass to production.** Already correct (`env.ts:83-85`,
dead-code-eliminated); keep the canary-grep check documented at `env.ts:37-40`.

**Do not pre-emptively unify the V1 and V2 session keys.** V1 writes `token` +
`sb-*-auth-token`; this console writes `flexprice.session`. If both are ever served
from one origin, signing in on one will not sign you in on the other. That is a
migration decision (§5), not something to silently paper over.

---

## 4. Phases

Sizes are relative, not estimates.

| # | Work | Where | Size | Unblocks |
| --- | --- | --- | --- | --- |
| **1a** | `refresh_token` + `expires_at` on `AuthResponse`; stop discarding them in `supabaseAuth.Login` | backend | S | the whole fix |
| **1b** | `POST /v1/auth/refresh` + `Refresh` on the `Provider` interface | backend | S | 2 |
| **1c** | `GET /v1/auth/capabilities` | backend | S | 3, 5 |
| **2** | Token lifecycle: proactive refresh, single-flight, cross-tab, 401-after-refresh-fails | console | **M** | **fixes hourly logout** |
| **3** | `useAuthCapabilities` + fail-open fallback; gate the provider buttons | console | S | 5 |
| **4** | `AuthStrategy` interface; refactor the current path into `PasswordStrategy` | console | M | 5, 6 |
| **5** | Routes + hooks: forgot-password, accept-invitation, sign-up | console | M | — |
| **6** | `SamlStrategy`: button, callback route, nonce + pending-marker checks | console | M | — |
| **7** | Broker password reset / invite server-side so they work on every provider | backend | M | 5 on non-Supabase |
| **8** | Presentation config (branding, template, regions, feature flags) served at runtime | both | L | white-label |

**Phase 2 is the one that matters.** 1a+1b+2 together are the difference between a
console people get logged out of every hour and one they do not. Everything after
is capability, not correctness.

Phases 3–6 are each independently shippable and each degrades safely: with no
backend capabilities endpoint the console is password-only, which is exactly what
it is today.

---

## 5. Decisions needed

1. **Token storage** — (a) `localStorage` now with the strategy boundary in place,
   or (b) go straight to `httpOnly` refresh cookie + in-memory access token?
   Recommendation: (a), designed for (b).
2. **V1/V2 coexistence** — will both consoles ever be served from the same origin
   during migration? If yes, the session keys and sign-out need to be reconciled
   deliberately; if no, nothing to do.
3. **Per-tenant capabilities** — is "this tenant refuses password login"
   (`config.yaml:24-25`) a case that needs supporting at sign-in, or is
   deployment-level enough for now?
4. **Google OAuth** — worth brokering server-side, or drop the button entirely
   until someone asks?

## 6. Verification

- **Expiry**: mint a short-TTL Supabase token, leave the console idle past it,
  confirm a silent refresh and no bounce to `/sign-in`.
- **Single-flight**: expire the token, load a page firing several parallel
  queries, assert exactly one `/auth/refresh` leaves the browser.
- **Cross-tab**: two tabs, sign out of one, confirm the other follows.
- **Fail-open**: point the console at a backend with no `/auth/capabilities` and
  confirm the password form renders normally.
- **Self-hosted**: a default `flexprice`-provider backend must work with *no*
  configuration beyond `VITE_FLEXPRICE_API_URL` — that is the test that the
  build-time provider knob really is gone.
- **API key still stripped**: keep the `sk_canary` build-and-grep from
  `env.ts:37-40`.
