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
 * There is no API-key variable here and there never will be. A Flexprice API
 * key in a `VITE_` variable is compiled into the bundle and served to every
 * visitor.
 */

/** A fake base URL. Nothing reaches the network when mocks are serving. */
const MOCK_API_URL = 'https://mock.flexprice.test/v1'

function read(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  return value && value.length > 0 ? value : undefined
}

const explicitMocks = read('VITE_USE_MOCKS')
const apiUrl = read('VITE_FLEXPRICE_API_URL')

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
  legacyConsoleUrl: read('VITE_LEGACY_CONSOLE_URL') ?? null,
  /** Local development only, until the auth surface lands. */
  devToken: read('VITE_DEV_JWT') ?? null,
  environmentId: read('VITE_ENVIRONMENT_ID') ?? null,
} as const
