/**
 * The only module that reads `import.meta.env`.
 *
 * It does **not** throw. An earlier version did, and the result was the worst
 * failure mode available: the shell was already mounted, so the throw happened
 * inside a lazily-loaded route chunk, Suspense caught the rejected import, and
 * the app rendered a blank body with no message anywhere. A misconfiguration
 * looked identical to an empty list.
 *
 * So configuration problems are *values* now. The app renders them as a screen
 * that says what is missing and how to fix it.
 *
 * ## On the API key
 *
 * This file used to say there was no API-key variable here and there never
 * would be. The reasoning behind that was right and is unchanged: a `VITE_`
 * variable is **not** a secret. Vite substitutes it at build time, so the
 * literal string ends up in a JavaScript chunk served to every visitor, and a
 * Flexprice API key is a tenant-wide credential with none of a JWT's
 * expiry. Shipping one that way is handing out write access to billing data.
 *
 * What changed is that the console now has a real session — `POST /auth/login`
 * for a JWT, `GET /environments` for the header every other call needs — so the
 * key is no longer the only way in. That makes it affordable to keep one
 * strictly for the case it is actually good at: poking at a local or staging
 * backend without a user account, where signing in is friction and there is no
 * public bundle to leak into.
 *
 * So `VITE_FLEXPRICE_API_KEY` exists, and it is gated on `import.meta.env.DEV`.
 * A production build does not merely ignore it: because `DEV` is a build-time
 * literal, the whole branch is dead code and the key is **not present in the
 * bundle at all**. `env.apiKey` is `null` there no matter what was set, and the
 * console says so if one was configured, because a key that silently stops
 * working is a debugging session nobody enjoys.
 *
 * That guarantee depends on details two lines below can destroy, so it is
 * checked rather than assumed — build with a canary value and grep `dist`:
 *
 *     VITE_FLEXPRICE_API_KEY=sk_canary pnpm --filter console build
 *     grep -r sk_canary apps/console/dist    # must find nothing
 */

/** A fake base URL. Nothing reaches the network when mocks are serving. */
const MOCK_API_URL = 'https://mock.flexprice.test/v1'

/**
 * An empty variable is an unset variable.
 *
 * Takes the value, not the name. That is not a style preference — it is what
 * makes the API key strippable. The previous version took a name and did
 * `import.meta.env[name]`, and a *dynamic* index is something Vite cannot
 * resolve at build time, so it substituted the entire env object instead: every
 * `VITE_` variable present when the bundle was built ended up as a string
 * literal in it, referenced or not, gated or not. Every access here is now a
 * static property read, so Vite replaces each one individually and the
 * minifier can drop the ones behind a false branch.
 */
function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const explicitMocks = clean(import.meta.env.VITE_USE_MOCKS)
const apiUrl = clean(import.meta.env.VITE_FLEXPRICE_API_URL)

/**
 * Mocks are used when asked for, or when there is nothing else to talk to.
 *
 * The earlier rule was "opt-in, never inferred", so that someone debugging a
 * real integration could not silently get mocks. That reasoning holds when an
 * API URL is configured — and does not apply when none is, because then there
 * is no integration to debug and the only alternative is a broken app. The
 * fallback announces itself in the console rather than happening quietly.
 */
const useMocks = explicitMocks === 'true' || (explicitMocks !== 'false' && apiUrl === undefined)

/**
 * The development-only API-key override. See the note at the top of this file.
 *
 * `import.meta.env.DEV` is a literal at build time, so this whole branch — and
 * the key with it — is dropped from a production bundle by dead-code
 * elimination. The key is not merely ignored in production; it is not present.
 */
const apiKey: string | null = import.meta.env.DEV
  ? (clean(import.meta.env.VITE_FLEXPRICE_API_KEY) ?? null)
  : null

/**
 * Whether a key was configured, as a boolean and never as the key.
 *
 * The production warning below has to know a key was set without the bundle
 * containing it, so this is the only reference to the variable outside the
 * dev-only branch above, and its shape matters more than it looks:
 *
 *   - It must be a **bare** expression on the substituted literal. Vite
 *     replaces `import.meta.env.VITE_FLEXPRICE_API_KEY` with the string, and
 *     the minifier then folds `!!"sk_live_…"` to `true` and discards it.
 *     Wrapping it in a helper — `clean(…) !== undefined` — defeats that: a
 *     function call is not foldable, so the key survives as an argument. That
 *     is not hypothetical; it is what the first version of this line did, and
 *     a canary build found the key sitting in `dist`.
 *   - It must be a truthiness test, not `!== undefined`. `.env.local` ships
 *     `VITE_FLEXPRICE_API_KEY=` as a placeholder, and an empty string is
 *     defined — so the stricter-looking comparison warned on every build that
 *     had no key at all.
 *
 * Both are silent failures in opposite directions, which is why the check is
 * `pnpm --filter console build` with a canary value and a grep of `dist`.
 */
const apiKeyConfigured: boolean = !!import.meta.env.VITE_FLEXPRICE_API_KEY

if (!import.meta.env.DEV && apiKeyConfigured) {
  console.warn(
    '[flexprice] VITE_FLEXPRICE_API_KEY was set when this bundle was built, and is ignored: ' +
      'API keys are honoured in development only. Sign in instead. Do not set it for a ' +
      'production build — a VITE_ variable is compiled in and served to every visitor.',
  )
}

/**
 * Supabase, for password reset only.
 *
 * Reset is the one flow the Flexprice API does not expose: the backend's public
 * auth routes are `/auth/signup`, `/auth/login` and SAML, and nothing else. V1
 * solved it by talking to Supabase from the browser, and this console now does
 * the same, so these two variables are read here.
 *
 * Unlike the API key above, these are genuinely publishable: the anon key is
 * designed to ship to browsers and is constrained by row-level security. It is
 * still per-deployment, which is why it is configuration and not a constant.
 *
 * ## Why this is per region
 *
 * The console can switch between the India and US APIs at runtime (see
 * `app/region.tsx`), and those are separate deployments with separate accounts
 * — so they are very likely separate Supabase projects. One project's anon key
 * cannot reset a password held by the other: the request would succeed against
 * the wrong project and simply never send an email to a user who exists only in
 * the other one. A per-region value prevents that, and `VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY` remain as the fallback for a single-region or
 * self-hosted deployment.
 *
 * Absent config is not an error. A self-hosted install has no Supabase at all,
 * and must still sign in normally — it simply gets no reset link.
 */
export interface SupabaseConfig {
  url: string
  anonKey: string
}

function supabaseFor(url: string | undefined, anonKey: string | undefined): SupabaseConfig | null {
  return url && anonKey ? { url, anonKey } : null
}

const supabaseDefault = supabaseFor(
  clean(import.meta.env.VITE_SUPABASE_URL),
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
)

const supabaseByRegion: Readonly<Record<string, SupabaseConfig | null>> = {
  in:
    supabaseFor(
      clean(import.meta.env.VITE_SUPABASE_URL_IN),
      clean(import.meta.env.VITE_SUPABASE_ANON_KEY_IN),
    ) ?? supabaseDefault,
  us:
    supabaseFor(
      clean(import.meta.env.VITE_SUPABASE_URL_US),
      clean(import.meta.env.VITE_SUPABASE_ANON_KEY_US),
    ) ?? supabaseDefault,
}

/**
 * Which hosted region this deployment *is*.
 *
 * Each region is its own deployment with its own API, its own accounts and
 * its own identity provider — so switching region is a navigation to another
 * dashboard, not a setting inside this one. `VITE_FLEXPRICE_REGION` is what
 * that deployment calls itself; unset (self-hosted, preview, mocks) means the
 * console is not part of the hosted set and offers no switch.
 */
export type RegionId = 'in' | 'us' | 'ca'

const REGION_IDS: readonly string[] = ['in', 'us', 'ca']

const declaredRegion = clean(import.meta.env.VITE_FLEXPRICE_REGION)?.toLowerCase()
const region: RegionId | null =
  declaredRegion && REGION_IDS.includes(declaredRegion) ? (declaredRegion as RegionId) : null

if (declaredRegion && region === null) {
  console.warn(
    `[flexprice] VITE_FLEXPRICE_REGION="${declaredRegion}" is not one of ${REGION_IDS.join(', ')} ` +
      'and is ignored. The region switcher will not be shown.',
  )
}

/**
 * Where each region's dashboard lives.
 *
 * Overridable as JSON so a preview or a differently-hosted region does not
 * need a code change: `{"us":"https://us.app.flexprice.io"}` replaces one
 * entry and leaves the rest. An entry that is not a URL is dropped rather
 * than sending someone to a broken address.
 */
const DEFAULT_REGION_URLS: Record<RegionId, string> = {
  in: 'https://in.app.flexprice.io',
  // The unprefixed host is the canonical one — it is what the OAuth redirect
  // URIs are registered against. `us.app.flexprice.io` is accepted as an alias
  // when detecting which region a browser is already on.
  us: 'https://app.flexprice.io',
  ca: 'https://ca.app.flexprice.io',
}

/** Hosts that mean a region without being its canonical address. */
export const REGION_HOST_ALIASES: Record<RegionId, string[]> = {
  in: [],
  us: ['https://us.app.flexprice.io'],
  ca: [],
}

function parseRegionUrls(): Record<RegionId, string> {
  const raw = clean(import.meta.env.VITE_FLEXPRICE_REGION_URLS)
  if (!raw) return DEFAULT_REGION_URLS
  try {
    const parsed = JSON.parse(raw) as Partial<Record<RegionId, unknown>>
    const out = { ...DEFAULT_REGION_URLS }
    for (const id of REGION_IDS as RegionId[]) {
      const value = parsed[id]
      if (typeof value !== 'string' || value.length === 0) continue
      try {
        out[id] = new URL(value).origin
      } catch {
        console.warn(`[flexprice] VITE_FLEXPRICE_REGION_URLS.${id} is not a URL and is ignored.`)
      }
    }
    return out
  } catch {
    console.warn('[flexprice] VITE_FLEXPRICE_REGION_URLS is not valid JSON and is ignored.')
    return DEFAULT_REGION_URLS
  }
}

const regionUrls = parseRegionUrls()

/** A configuration problem, as a value the app can render. */
export interface ConfigProblem {
  title: string
  detail: string
  fix: string
}

const problem: ConfigProblem | null =
  !useMocks && apiUrl === undefined
    ? {
        title: 'Flexprice is not configured',
        detail: 'VITE_FLEXPRICE_API_URL is not set, and mocks are switched off.',
        fix: 'Copy apps/console/.env.example to .env.local, or set VITE_USE_MOCKS=true to use the bundled fixtures.',
      }
    : null

if (useMocks && apiUrl === undefined && explicitMocks !== 'true') {
  console.warn(
    '[flexprice] No VITE_FLEXPRICE_API_URL set — serving the bundled fixture corpus. ' +
      'Set VITE_USE_MOCKS=false and a real URL to talk to a backend.',
  )
}

if (apiKey !== null) {
  console.warn(
    '[flexprice] Using VITE_FLEXPRICE_API_KEY. Sign-in is bypassed and every request ' +
      'carries this key. Development only — it is ignored in a production build.',
  )
}

/** `'true'` exactly, as V1 reads its feature flags. */
const flag = (value: unknown) => value === 'true'

/**
 * Support chat, exactly as V1 configures it: at most one provider is meant to
 * be on, and when both are, Intercom wins (see `app/supportChat/config.ts`).
 * None of these is a secret — the app ids are public widget ids.
 */
const intercom = {
  enabled: flag(import.meta.env.VITE_INTERCOM_ENABLED),
  // V1 still accepts its older name as a fallback.
  appId:
    clean(import.meta.env.VITE_INTERCOM_APP_ID) ??
    clean(import.meta.env.VITE_APP_INTERCOM_APP_ID) ??
    '',
}

const pylon = {
  enabled: flag(import.meta.env.VITE_PYLON_ENABLED),
  appId: clean(import.meta.env.VITE_PYLON_APP_ID) ?? '',
  /** Fetch the HMAC email hash from `POST /users/chat/verify` and pass it as `email_hash`. */
  identityVerificationEnabled: flag(import.meta.env.VITE_PYLON_IDENTITY_VERIFICATION_ENABLED),
}

/**
 * How people reach us — the Create environment dialog's Slack, Email and
 * Book a call, as V1's `config/contact.ts`.
 *
 * Each is one variable. Unset uses Flexprice's own; `none` hides that option,
 * for a white-label deployment that has no Slack or no booking page.
 */
export const DEFAULT_CONTACT = {
  slackUrl:
    'https://join.slack.com/t/flexpricecommunity/shared_invite/zt-39uat51l0-n8JmSikHZP~bHJNXladeaQ',
  email: 'support@flexprice.io',
  bookCallUrl: 'https://calendly.com/nikhil-flexprice/30min',
} as const

export interface ContactConfig {
  /** `null` when hidden. */
  slackUrl: string | null
  email: string | null
  bookCallUrl: string | null
}

function contactValue(raw: string | undefined, fallback: string): string | null {
  if (raw === undefined) return fallback
  return raw.trim().toLowerCase() === 'none' ? null : raw.trim()
}

/** The contact options from their variables (already `clean`ed). */
export function resolveContact(raw: {
  slackUrl?: string | undefined
  email?: string | undefined
  bookCallUrl?: string | undefined
}): ContactConfig {
  return {
    slackUrl: contactValue(raw.slackUrl, DEFAULT_CONTACT.slackUrl),
    email: contactValue(raw.email, DEFAULT_CONTACT.email),
    bookCallUrl: contactValue(raw.bookCallUrl, DEFAULT_CONTACT.bookCallUrl),
  }
}

const contact = resolveContact({
  slackUrl: clean(import.meta.env.VITE_CONTACT_SLACK_URL),
  email: clean(import.meta.env.VITE_CONTACT_EMAIL),
  bookCallUrl: clean(import.meta.env.VITE_CONTACT_BOOK_CALL_URL),
})

export const env = {
  useMocks,
  problem,
  apiUrl: apiUrl ?? MOCK_API_URL,
  /**
   * Where the current dashboard lives, if anywhere.
   *
   * Used only by the migration placeholders, to hand someone off to the screen
   * that works today. Unset means no hand-off link is offered — a link to a
   * guessed origin is worse than none.
   */
  legacyConsoleUrl: clean(import.meta.env.VITE_LEGACY_CONSOLE_URL) ?? null,
  /**
   * The origin Supabase sends Google sign-in and confirmation emails back to,
   * when it must not be the one the console is running on.
   *
   * Staging shares prod's Supabase project, which does not allow staging's
   * origin. Supabase then falls back to its Site URL — the V1 dashboard — so
   * staging sets this to the V2 production origin instead. Unset everywhere
   * else: the console's own origin is used.
   */
  authRedirectOrigin: clean(import.meta.env.VITE_AUTH_REDIRECT_ORIGIN)?.replace(/\/+$/, '') ?? null,
  /**
   * A raw Flexprice API key, used in place of a signed-in JWT.
   *
   * Always `null` in a production build. When set, the session surface steps
   * out of the way entirely: the key is the bearer token and `/sign-in` is not
   * enforced. See the note at the top of this file for why that is safe here
   * and would not be safe shipped.
   */
  apiKey,
  /**
   * Supabase for the region currently selected, or `null` where none is
   * configured. `null` means the console offers no password reset, which is
   * the correct and honest state for a self-hosted deployment.
   */
  supabaseFor: (region: string): SupabaseConfig | null =>
    supabaseByRegion[region] ?? supabaseDefault,
  /** This deployment's region, or `null` when it is not one of the hosted set. */
  region,
  /** Each region's dashboard origin, after any `VITE_FLEXPRICE_REGION_URLS` override. */
  regionUrls,
  /** Support chat providers. */
  intercom,
  pylon,
  /** Slack, email and booked-call contact options (`VITE_CONTACT_*`). */
  contact,
  /** A production build — config warnings stay quiet there, as in V1. */
  isProd: import.meta.env.PROD,
  /**
   * This build's version (its commit), stamped by `app-version.ts`; the same
   * value is published at `/meta.json`. `null` when nothing stamped it.
   */
  appVersion: clean(import.meta.env.VITE_APP_VERSION) ?? null,
} as const
