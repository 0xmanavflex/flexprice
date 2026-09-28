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
   * A raw Flexprice API key, used in place of a signed-in JWT.
   *
   * Always `null` in a production build. When set, the session surface steps
   * out of the way entirely: the key is the bearer token and `/sign-in` is not
   * enforced. See the note at the top of this file for why that is safe here
   * and would not be safe shipped.
   */
  apiKey,
} as const
