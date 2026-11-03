# Configurable authentication: plan

> Status: in progress. Written 2026-10-14 against `flexprice/flexprice@c569d5de`,
> `flexprice-front@35bf5114` and this repo at `ac3237c`.
>
> **Revised 2026-10-14 after the JWT expiry issue was resolved outside this repo.**
> Phases 1a, 1b and 2 (refresh-token plumbing and silent renewal) are **dropped**:
> no silent JWT call is needed. See §1.1. Sign-up, the region picker and the
> capabilities seam have since landed; see §4.

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
is public and provider-agnostic: it works identically on all three. The console
should mirror that interface, not re-derive it from env vars.

---

## 1. What is actually wrong

Established by reading all three repos; evidence inline.

### 1.1 Session expiry: resolved, and refresh is dropped

The original concern: `supabaseAuth.Login` (`internal/auth/supabase.go:90-105`)
receives `AuthenticatedDetails` carrying `RefreshToken`, `ExpiresIn` and
`TokenType` (`nedpals/supabase-go@v0.5.0/auth.go:69-74`) and returns **only**
`user.AccessToken`, so `dto.AuthResponse` is `{token, user_id, tenant_id}` and a
client has nothing to refresh with. Token lifetime differs by provider:

| Deployment            | Provider    | Token TTL                                  |
| --------------------- | ----------- | ------------------------------------------ |
| Self-hosted (default) | `flexprice` | 30 days (`internal/auth/flexprice.go:138`) |
| Cloud                 | `supabase`  | GoTrue setting                             |

**This has been resolved outside this repository, and silent refresh is no longer
required.** Nothing in the backend tree changed: `dto.AuthResponse`,
`supabaseAuth.Login` and the `Provider` interface are byte-identical between
`96f73a5` and `c569d5de`, and no remote branch or merged PR touches them. So the
fix is a deployment-level setting (the GoTrue token lifetime, or the provider the
hosted deployment runs), which is invisible here.

Two things that follow, worth keeping in view:

- The 401 handler (`main.tsx:96-101`) is now the **only** thing standing between
  an expired token and a console full of failing requests. It must keep working;
  it is no longer a backstop behind a refresh.
- A longer-lived token is a longer window for a leaked one, and these JWTs have
  no revocation path. That is a deliberate trade, not a free win: worth being
  the team's explicit choice rather than a side effect.

To re-check the live value at any time, decode the `exp` of a token from
`POST /auth/login`:

```sh
curl -s -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' |
  python3 -c 'import sys,json,base64,datetime as d; t=json.load(sys.stdin)["token"].split(".")[1]; \
c=json.loads(base64.urlsafe_b64decode(t+"=="*(-len(t)%4))); \
print("expires", d.datetime.fromtimestamp(c["exp"]), "| ttl", d.timedelta(seconds=c["exp"]-c["iat"]))'
```

### 1.2 The console has no auth configuration at all

`apps/console/src/env.ts` reads four variables: `VITE_FLEXPRICE_API_URL`,
`VITE_USE_MOCKS`, `VITE_FLEXPRICE_API_KEY`, `VITE_LEGACY_CONSOLE_URL`. There is no
provider, no SSO tenant, no region, no branding, no feature gating.

It implements exactly one path, which happens to be V1's _self-hosted_ path:
`POST /auth/login` (`packages/api/src/session.ts:125`) →
`localStorage['flexprice.session']` (`app/session/storage.ts:17`).

That path is correct and works against hosted: `docs/audit/live-integration/`
proves real 200s and a real 403 from `api.cloud.flexprice.io`. **Nothing here needs
to be thrown away.** What is missing is everything around it.

### 1.3 Password reset has no backend to call: on any provider

This is the blocker that outranks the rest, and it was not obvious.

The backend exposes exactly **two** public auth routes plus SAML
(`internal/api/router.go:151-167`):

```
POST /v1/auth/signup
POST /v1/auth/login
GET|POST /v1/auth/saml/:tenant/{metadata,login,acs}   # only when auth.saml.enabled
```

There is no `/auth/reset-password`, no `/auth/resend-verification`, no
`/auth/signup/confirmation`, no `/auth/logout`. V1's `AuthApi` declares
`ResetPassword`, `VerifyEmail`, `ResendVerificationEmail` and `Logout`
(`src/api/AuthApi.ts:15-29`): **those four call routes that do not exist.**

V1 does password reset entirely in the browser, through supabase-js:

- `ForgotPasswordForm.tsx:23` → `supabase.auth.resetPasswordForEmail(...)`
- `ResetPasswordForm.tsx:39` → `supabase.auth.updateUser({ password })`

So forgot-password works on V1 **only on Supabase deployments**. A self-hosted
`flexprice`-provider install has no password reset at all, in V1 or here.

There are exactly two ways to give this console a working reset, and no third:

1. **Broker it server-side.** `ResetPasswordForEmail` (`auth.go:280`) and
   `InviteUserByEmail` (`auth.go:344`) are already on the Supabase client the
   backend holds. New public routes, and it works on every provider.
2. **Put supabase-js in the browser**, as V1 does. Needs `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, and works on Supabase deployments only.

This is the decision that determines the environment-variable answer in §7.
Until one is chosen, `passwordReset.enabled` reports `false` and the console
honestly shows no link: which is the current behaviour.

### 1.4 Surfaces that exist but are not reachable

| Surface           | What exists                                                                                           | What is missing                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forgot password   | `ui/pages/auth/ForgotPasswordForm.tsx` + stories; `SignInForm` accepts `onForgotPassword`             | **no backend endpoint** (§1.3); no route, no hook                                                                                                            |
| Accept invitation | `ui/pages/auth/AcceptInvitationForm.tsx` + stories; `MembersPanel` can send invites                   | **no backend endpoint**; no route: the invitee has nowhere to land                                                                                           |
| SAML sign-in      | `useSamlConfig` reads the setting (`query/settings.ts:888`); routes exist on the backend when enabled | no button, no `?sso=`, no callback route                                                                                                                     |
| Google            | button drawn in the design                                                                            | no user-facing OAuth route on the backend at all: `/oauth/init` and `/oauth/complete` are the QuickBooks and Zoho **integration** consent flows, not sign-in |

`docs/v1-v2-gap.md:68` claims V2 "has sign-in, forgot-password and
accept-invitation". That is true of the component library, not of the
application, and forgot-password cannot be true of either until §1.3 is settled.

### 1.4 V1's config model, and why not to copy it

`src/config/config.ts` declares `config.auth = {enabled, provider, url, anonKey}`.
`grep -rn 'config\.auth' src/` returns reads of **`url` and `anonKey` only**:

- `VITE_AUTH_ENABLED` / `VITE_SUPABASE_ENABLED`: never read. Setting it to
  `false` does not disable auth.
- `VITE_AUTH_PROVIDER` (`flexprice` | `supabase`): never read. `AUTH_PROVIDER` is
  a dead enum.

The only live switch is `config.app.env === APP_ENV.SelfHosted`. Those two dead
knobs are the fossil of exactly the mistake this plan exists to avoid: a
build-time browser claim about a server-side fact, which drifted and was never
detected because nothing could detect it.

---

## 2. Design

### 2.1 Split configuration by who actually knows the answer

The current `env.ts` is **right** and should not grow. The discipline is:

| Kind               | Source                                            | Examples                                                                           | Why                                                                            |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Infrastructure** | build-time `VITE_*`                               | which API URL, mocks on/off, dev API key, legacy console URL                       | The bundle cannot discover its own backend. Genuinely build-time.              |
| **Capability**     | runtime, from the API                             | which provider, is signup open, is SAML on, token TTL, is password reset available | The server owns these. Asking removes the whole class of drift bugs.           |
| **Presentation**   | runtime, from the API, with a build-time fallback | brand name, logo, auth page template, region list, feature flags                   | Per-deployment and per-tenant; serving it means one bundle for every customer. |

Everything V1 put in column 1 that belongs in column 2 is a bug waiting to happen.

### 2.2 Backend contract: three additions

This is the entire backend ask. Each is additive and non-breaking.

**(a) `GET /v1/auth/capabilities`: public, unauthenticated, cacheable**

Mounted in the public group next to login (`internal/api/router.go:144-152`).
Reports the deployment's own configuration:

```jsonc
{
  "provider": "supabase", // cfg.Auth.Provider: already known
  "password": { "enabled": true, "min_length": 8 },
  "signup": { "enabled": true, "requires_email_confirmation": true },
  "password_reset": { "enabled": true },
  "saml": { "enabled": true, "tenant_hint_required": true },
  "oauth": { "google": false },
  "session": { "access_token_ttl_seconds": 3600, "refresh": true },
}
```

Every field is a value the server already holds: `cfg.Auth.Provider`,
`cfg.Auth.SAML.Enabled` (the same flag that decides whether the SAML routes are
mounted at all, `router.go:160`), and the provider's own token TTL.

Leak check: this exposes only _which methods exist_, which is already observable
by probing the endpoints: V1's `SamlSignin` literally does this with a
`redirect: 'manual'` fetch against `/auth/saml/:tenant/login` and treats 404 as
"not available" (`SamlSignin.tsx:91-95`). One honest endpoint beats three probes.

> Per-tenant nuance: `config.yaml:17-26` notes that a tenant's `saml_config`
> decides its own identity provider and _whether password login is refused_. So
> `GET /auth/capabilities` answers for the **deployment**; a per-tenant answer
> needs a tenant hint and should be a later, separate addition. Do not block
> phase 1 on it.

**(b) Return the refresh material that already exists**

Extend `auth.AuthResponse` (`internal/auth/provider.go:23-32`) and
`dto.AuthResponse` (`internal/api/dto/auth.go:21`) with `refresh_token` and
`expires_at`. In `supabaseAuth.Login`, stop dropping `user.RefreshToken` /
`user.ExpiresIn`. The `flexprice` provider returns an empty refresh token and its
30-day expiry: a client that sees no refresh token simply does not schedule one.

Additive JSON fields; the existing SDK and V1 ignore them.

**(c) `POST /v1/auth/refresh`: public, provider-dispatched**

`Auth.RefreshUser(ctx, userToken, refreshToken)` already exists in the Supabase
client (`auth.go:109`), so the Supabase implementation is roughly fifteen lines.
The `flexprice` provider can re-mint from a valid token or return
`ErrPermissionDenied`: either is fine, because with a 30-day TTL no client will
call it.

Add a `Refresh` method to the `Provider` interface so this dispatches exactly like
`Login` does, rather than branching on provider in the handler.

> While in `internal/auth/supabase.go`: `ResetPasswordForEmail` (`auth.go:280`)
> and `InviteUserByEmail` (`auth.go:344`) are also already available on the
> client. Brokering those server-side is what makes §2.5's forgot-password and
> accept-invitation work on _every_ provider rather than Supabase only.

### 2.3 Frontend: capabilities as a typed, fail-open value

New `packages/api/src/authCapabilities.ts`, beside `session.ts` and for the same
documented reason: it is a bootstrap call the SDK cannot make. Then
`useAuthCapabilities()` in `@fp/query`, fetched once before `/sign-in` renders and
cached for the session.

**Fail open, not closed.** If the probe fails: 404 on an older backend, a 500, a
timeout, CORS: resolve to _password-only_, the one method that exists on every
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
  restore?(): Session | null // e.g. read a SAML callback fragment
  signOut(session): Promise<void>
}
```

- `PasswordStrategy`: what exists today; works on all three backends unchanged.
- `SamlStrategy`: redirect out, restore from the callback.
- `OAuthStrategy`: later, if Google is brokered server-side.

The strategy registry is the only place that reads capabilities. `SignInPage`
renders whatever strategies the registry offers; `SessionProvider` stores whatever
one of them returns. This keeps the symmetry with
`internal/auth/provider.go`: one interface, one dispatch point, no provider
conditionals scattered through the UI.

### 2.5 Token lifecycle

The substance of the fix. Four properties, each one a real failure if skipped:

1. **Proactive refresh.** Schedule at ~75% of `expires_at`. Refreshing on 401 only
   means every expiry costs the user a visibly failed request.
2. **Single-flight.** One shared refresh promise. Without it, a page firing eight
   parallel queries on an expired token starts eight refreshes, and whichever
   lands last wins: on a provider that rotates refresh tokens, the other seven
   are now invalid and the user is signed out anyway.
3. **Cross-tab.** `BroadcastChannel` so a refresh in one tab updates the others
   and a sign-out signs out all of them. V1 gets this free from supabase-js;
   here it must be explicit, or two tabs will fight over one rotating token.
4. **401 still ends the session: but only after a refresh attempt fails.** Keep
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

- **Forgot password / reset**: route `/forgot-password`, pass
  `onForgotPassword` into `SignInForm`, gate on `password_reset.enabled`.
- **Accept invitation**: route `/accept-invitation`, closing the loop on invites
  `MembersPanel` can already send.
- **Sign up**: `useSignUp` over the existing `signUp()`, gated on
  `signup.enabled`. Honour `requires_email_confirmation` rather than assuming.
- **SAML**: button gated on `saml.enabled`, plus the callback route.
- **Google / SAML placeholder buttons**: stop rendering unconditionally
  (`SignInScreen.tsx:46-49`); drive `PROVIDERS` off capabilities so a button
  appears only when it works. Delete the "isn't enabled for this workspace yet"
  fallback once nothing can reach it.

**Port V1's SAML security properties verbatim.** `SamlSignin.tsx:29-61` sets a
per-tab `sso_pending` marker and a per-login nonce carried as SAML `RelayState`
and checked at the callback. That nonce is what stops a session-fixation attack:
sending someone `/auth/callback#token=<attacker's>` so their console adopts the
attacker's session. It is easy to lose in a rewrite and must not be. Keep
`sessionStorage` (per tab, cleared on close) rather than `localStorage`, for the
reason V1 documents.

---

## 3. Explicit non-goals: traps to avoid

**Do not port `VITE_AUTH_PROVIDER` or `VITE_APP_ENV=self-hosted`.** They are the
precise mistake. Both are dead code in V1 and the drift they allow is undetectable.

**supabase-js in the console: decided, and scoped.** This was listed here as a
non-goal. It was overruled on 2026-10-14 (§5.1), because password reset has no
backend to call on any provider (§1.3) and waiting for one would mean shipping a
console with no reset at all.

What makes that affordable is the scope. `app/auth/passwordReset.ts` uses the
client for two calls: request a reset email, set the new password: and nothing
else. `persistSession` and `autoRefreshToken` are **off**, so supabase-js writes
no storage and refreshes nothing; the momentary session the recovery link mints
is signed out as soon as the password is set. Sign-in stays `POST /auth/login`
and the session stays `SessionProvider`'s.

That is the line to hold. The costs originally listed here are all real and all
arrive the moment the client grows past those two calls:

- **Two token lifecycles and two storage keys**: avoided only by
  `persistSession: false`. Turning it on makes supabase-js a second session, and
  the console's idea of who is signed in starts depending on which one you ask.
- **The redirect allowlist.** Every origin: both region dashboards, localhost,
  every preview deploy: must be in the Supabase project's Redirect URLs. A
  missing entry is not an error: GoTrue substitutes the project's Site URL and
  returns success, so it surfaces only as a link in someone's inbox pointing at
  the wrong host.
- **It does not cover self-hosted.** A `flexprice`-provider install has no
  Supabase, so it still has no password reset. The console reports this honestly
  rather than showing a link that cannot work, but the gap is real and only
  brokering (§4, phase 3) closes it.

**Google is still not this.** Reset was worth the exception because there is no
alternative; Google has one: broker it server-side, in the same shape as SAML.
There is no user-facing Google route on the backend at all today.

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

Revised. Refresh work is dropped (§1.1); sign-up, the region picker and the
capabilities seam have landed.

### Done

| Work                                                                                                         | Where   | Commit    |
| ------------------------------------------------------------------------------------------------------------ | ------- | --------- |
| Sign-up screen, `/sign-up` route, `POST /auth/signup`                                                        | console | `0ea3133` |
| Data region picker: switches the API between India and US at runtime                                         | console | `d80bf15` |
| `GET /auth/capabilities` client + `useAuthCapabilities`, fail-open to password-only                          | console | `ac3237c` |
| Google button drawn only where Google exists (was: always drawn, explained on click that it was not enabled) | console | `ac3237c` |
| Sign-up password minimum 6 → 8, matching what the API enforces                                               | console | `ac3237c` |

The region picker is worth noting as a second instance of the same idea: it
switches `serverURL` at runtime through `RegionProvider` rather than baking one
region per build, and `useAuthCapabilities` is keyed by that URL so the two
regions cannot show each other's sign-in methods.

### Next

| #      | Work                                                                        | Where   | Size | Notes                                                     |
| ------ | --------------------------------------------------------------------------- | ------- | ---- | --------------------------------------------------------- |
| **1c** | `GET /v1/auth/capabilities`                                                 | backend | S    | the console already consumes it and degrades without it   |
| **2**  | **Decide §1.3**: broker reset server-side, or supabase-js in the browser    | :       | :    | **blocks forgot-password and accept-invitation entirely** |
| 3      | Public reset + invite routes, brokered through the provider                 | backend | M    | only if §1.3 resolves to "broker"                         |
| 4      | `AuthStrategy` interface; current path becomes `PasswordStrategy`           | console | M    |                                                           |
| 5      | Forgot-password and accept-invitation routes + hooks, gated on capabilities | console | M    | needs 2, and 3 if brokering                               |
| 6      | `SamlStrategy`: button, callback route, nonce + pending-marker checks       | console | M    | backend routes already exist                              |
| 7      | Presentation config (branding, template, feature flags) served at runtime   | both    | L    | white-label                                               |

Phases 4–6 each degrade safely: with no capabilities endpoint the console is
password-only, which is what it is today.

## 5. Decisions needed

1. ~~**Password reset (§1.3)**~~: **decided 2026-10-14: supabase-js in the
   browser**, shipped in `c153ac4`. Brokering was recommended and was not
   chosen; it remains phase 3, and remains the only thing that gives self-hosted
   a password reset. The browser client is scoped to two calls and holds no
   session: see §3.
2. **Token storage**: `localStorage` today. The access token is XSS-readable
   and now longer-lived (§1.1). An `httpOnly` refresh cookie plus an in-memory
   access token is the better destination; it needs cross-origin cookie, CORS
   and CSRF work. Recommendation: keep `localStorage`, put storage behind the
   strategy so it is a swap later.
3. **V1/V2 coexistence**: will both consoles ever be served from the same origin
   during migration? If yes, the session keys and sign-out need to be reconciled
   deliberately; if no, nothing to do.
4. **Per-tenant capabilities**: is "this tenant refuses password login"
   (`config.yaml:24-25`) a case that needs supporting at sign-in, or is
   deployment-level enough for now?
5. **Google OAuth**: there is no user-facing Google route on the backend at
   all. Broker one, or drop the button until someone asks?

## 6. Verification

- **Expiry**: mint a short-TTL Supabase token, leave the console idle past it,
  confirm a silent refresh and no bounce to `/sign-in`.
- **Single-flight**: expire the token, load a page firing several parallel
  queries, assert exactly one `/auth/refresh` leaves the browser.
- **Cross-tab**: two tabs, sign out of one, confirm the other follows.
- **Fail-open**: point the console at a backend with no `/auth/capabilities` and
  confirm the password form renders normally.
- **Self-hosted**: a default `flexprice`-provider backend must work with _no_
  configuration beyond `VITE_FLEXPRICE_API_URL`: that is the test that the
  build-time provider knob really is gone.
- **API key still stripped**: keep the `sk_canary` build-and-grep from
  `env.ts:37-40`.

---

## 7. Environment variables

The short answer: **the console needs no new variables, and in particular it
needs no Supabase URL or anon key**: unless decision 1 in §5 resolves to
"supabase-js in the browser".

### What the console reads today: the complete list

All in `apps/console/src/env.ts`, the only module that touches `import.meta.env`.

| Variable                  | Required            | Meaning                                                                                                                                              |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_FLEXPRICE_API_URL`  | yes, unless mocking | Which backend. India `https://api.cloud.flexprice.io/v1`, US `https://us.api.flexprice.io/v1`, or your own. Unset ⇒ mocks, announced in the console. |
| `VITE_USE_MOCKS`          | no                  | `true` serves the fixture corpus; no network, no account.                                                                                            |
| `VITE_FLEXPRICE_API_KEY`  | no                  | Dev-only bearer override; bypasses `/sign-in`. **Dropped from production builds** by dead-code elimination: never set it for one.                    |
| `VITE_LEGACY_CONSOLE_URL` | no                  | Where the migration placeholders and the "Go back to old UI" strip hand off to.                                                                      |

Setting `VITE_FLEXPRICE_API_URL` to one of the two hosted APIs is also what turns
the region picker on (`app/region.tsx:22-24`); a self-hosted URL offers no switch,
because there is nothing to switch to.

### What auth needs added: nothing

`POST /auth/login` is provider-agnostic: the backend brokers Supabase: so a
password sign-in works against cloud and self-hosted with `VITE_FLEXPRICE_API_URL`
alone. SAML needs no variable either: the tenant comes from `?sso=<tenant>` and
whether the feature exists comes from `/auth/capabilities`.

V1's `VITE_SSO_TENANT_ID` is the one knob with a real purpose: a single-tenant
deployment showing the SSO button without a `?sso=` link. Even that is better
answered by the capabilities endpoint returning a default tenant hint, which
keeps it out of the bundle.

### What the _backend_ needs: where the Supabase config actually belongs

Already present and server-side, in `internal/config/config.yaml` / `FLEXPRICE_*`:

```yaml
auth:
  provider: 'flexprice' # or "supabase"
  secret: '…' # JWT signing secret (flexprice provider)
  supabase:
    service_key: '…' # required when provider is supabase
  saml:
    enabled: false # mounts the SAML routes when true
```

This is the right home for them. The service key is a secret and must never be in
a browser bundle; the provider is a server fact the console now asks for.

### Only if §5.1 resolves to "supabase-js in the browser"

Then, and only then:

| Variable                 | Why                                                  |
| ------------------------ | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`      | project URL for the browser client                   |
| `VITE_SUPABASE_ANON_KEY` | anon key: public by design, but still per-deployment |

And the costs come with it: every origin the console is served from (both region
dashboards, localhost, every Vercel preview) must be listed in the Supabase
project's **Redirect URLs**. A missing entry is not an error: GoTrue silently
substitutes the project's Site URL, so it surfaces only as a reset email pointing
at the wrong host. V1 documents this at length beside `VITE_SUPABASE_URL` in its
`.env.example` and in `utils/auth/authRedirect.ts`. It also means reset works on
Supabase deployments only, and self-hosted still has none.

That asymmetry is the argument for brokering.
