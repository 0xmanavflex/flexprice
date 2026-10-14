import { fetchWithTimeout } from './timeout'

/**
 * Which ways of signing in this deployment actually offers.
 *
 * ## Why this is asked rather than configured
 *
 * The provider is a **server-side** fact. The backend picks it in
 * `internal/config/config.yaml` (`auth.provider`: `flexprice` | `supabase` |
 * `saml`) and `NewProvider(cfg)` dispatches on it; whether SAML exists at all is
 * `auth.saml.enabled`, which decides whether those routes are mounted.
 *
 * V1 mirrored that into the browser as build-time `VITE_` variables and the two
 * drifted immediately: `VITE_AUTH_PROVIDER` and `VITE_AUTH_ENABLED` are declared,
 * parsed, and read by nothing — the live switch is a *different* variable
 * (`VITE_APP_ENV=self-hosted`). Nothing could detect that, because a build-time
 * claim about a server-side fact has nothing to check itself against. Asking the
 * server removes the whole class of bug, and means one bundle serves the cloud,
 * a self-hosted install and a preview deploy without a rebuild.
 *
 * ## Fail open, never closed
 *
 * `read()` never throws and never rejects. Any failure — a 404 from a backend
 * that predates the endpoint, a 500, a timeout, CORS — resolves to
 * {@link PASSWORD_ONLY}: email and password, the one method every Flexprice
 * deployment has ever had.
 *
 * That direction matters. Failing closed would let a transient 500 hide a
 * working sign-in method and strand the user on a screen with no way in, which
 * is strictly worse than offering the method that is always there. It is the
 * same rule `useSamlConfig` already applies in `@fp/query`, for the same reason:
 * "we could not read it" and "there is nothing to read" are different facts, and
 * guessing in the wrong direction locks people out.
 *
 * It also means this ships safely *before* the endpoint does. Until the backend
 * grows `GET /auth/capabilities`, every deployment reads as password-only, which
 * is exactly how the console behaves today.
 */

/** The identity provider the deployment runs, in the API's own vocabulary. */
export type AuthProviderId = 'flexprice' | 'supabase' | 'saml'

export interface AuthCapabilities {
  provider: AuthProviderId
  password: { enabled: boolean; minLength: number }
  signUp: { enabled: boolean }
  passwordReset: { enabled: boolean }
  saml: { enabled: boolean }
  oauth: { google: boolean }
}

/**
 * What every Flexprice deployment can do, and the answer to any failed read.
 *
 * `minLength` is 8 because that is what the API enforces on both
 * `SignUpRequest` and `LoginRequest`. It is a default, not a belief: a
 * deployment that reports its own number overrides it, which is the point of
 * asking rather than hardcoding.
 */
export const PASSWORD_ONLY: AuthCapabilities = {
  provider: 'flexprice',
  password: { enabled: true, minLength: 8 },
  signUp: { enabled: true },
  passwordReset: { enabled: false },
  saml: { enabled: false },
  oauth: { google: false },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function bool(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}

/** A nested block, or an empty one — an absent section means "default", not "off". */
function block(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key]
  return isRecord(value) ? value : {}
}

function toProvider(value: unknown): AuthProviderId {
  return value === 'supabase' || value === 'saml' || value === 'flexprice'
    ? value
    : PASSWORD_ONLY.provider
}

/**
 * Reads the response leniently, field by field, against {@link PASSWORD_ONLY}.
 *
 * Deliberately not a schema parse that rejects the whole body on one unknown
 * shape. This endpoint is the thing that decides whether a user can sign in at
 * all, so a backend that adds a field, renames a section or answers with a
 * slightly different envelope must degrade to "password works" rather than to
 * "nothing works".
 */
export function toAuthCapabilities(body: unknown): AuthCapabilities {
  if (!isRecord(body)) return PASSWORD_ONLY

  const password = block(body, 'password')
  const rawMin = password['min_length']
  // A non-positive or absurd minimum is a backend bug; neither should be able to
  // make the form reject every password a user can actually type.
  const minLength =
    typeof rawMin === 'number' && Number.isInteger(rawMin) && rawMin > 0 && rawMin <= 128
      ? rawMin
      : PASSWORD_ONLY.password.minLength

  return {
    provider: toProvider(body['provider']),
    password: {
      enabled: bool(password, 'enabled', PASSWORD_ONLY.password.enabled),
      minLength,
    },
    signUp: {
      enabled: bool(block(body, 'signup'), 'enabled', PASSWORD_ONLY.signUp.enabled),
    },
    passwordReset: {
      enabled: bool(block(body, 'password_reset'), 'enabled', PASSWORD_ONLY.passwordReset.enabled),
    },
    saml: {
      enabled: bool(block(body, 'saml'), 'enabled', PASSWORD_ONLY.saml.enabled),
    },
    oauth: {
      google: bool(block(body, 'oauth'), 'google', PASSWORD_ONLY.oauth.google),
    },
  }
}

/**
 * Asks the deployment what it offers. Resolves to {@link PASSWORD_ONLY} on any
 * failure — see the note at the top of this file.
 *
 * Unauthenticated by design: it is read before anyone has signed in, and it
 * reports only *which methods exist*, which is already observable by probing the
 * endpoints. V1 does exactly that probe today, with a `redirect: 'manual'` fetch
 * against the SAML login route, reading 404 as "not available". One honest
 * answer beats three guesses.
 */
export async function fetchAuthCapabilities(serverURL: string): Promise<AuthCapabilities> {
  const url = `${serverURL.replace(/\/+$/, '')}/auth/capabilities`

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: new Headers({ Accept: 'application/json' }),
    })
    if (!response.ok) return PASSWORD_ONLY
    return toAuthCapabilities(await response.json())
  } catch {
    // Offline, DNS, CORS, abort, deadline, or a body that is not JSON. None of
    // them say password sign-in is unavailable, so none of them may remove it.
    return PASSWORD_ONLY
  }
}
