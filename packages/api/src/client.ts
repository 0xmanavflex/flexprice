import { type Fetcher, Flexprice, HTTPClient } from '@flexprice/sdk'
import { toApiError } from './errors'

/**
 * How a request proves who it is.
 *
 * Deliberately async getters rather than values: on a fresh sign-in the
 * environment is not known until the environments call resolves, and a JWT can
 * expire mid-session. Reading them per request means no caller has to rebuild
 * the client, and no call goes out with a stale header.
 */
export interface AuthSource {
  /** The signed-in user's JWT, or null when signed out. */
  getToken: () => Promise<string | null>
  /**
   * Active environment. Every call except the discovery routes needs it —
   * the API answers 403 without it.
   */
  getEnvironmentId: () => Promise<string | null>
}

export interface ClientOptions {
  /** Regional base URL, e.g. https://api.cloud.flexprice.io/v1 */
  serverURL: string
  auth: AuthSource
  /** Called on every 401 so the app can end the session in exactly one place. */
  onUnauthorized?: () => void
  /**
   * Replaces `fetch`. The seam for tests and for instrumentation; production
   * leaves it unset.
   */
  fetcher?: Fetcher
}

/**
 * Routes reachable before an environment can possibly be known.
 *
 * Fetching the environment list is *how* an active one gets chosen, and the
 * current-user lookup is what says whose environments to list. Gating these on
 * an environment deadlocks sign-in.
 */
const ENVIRONMENT_EXEMPT = ['/environments', '/users/me']

function needsEnvironment(url: string): boolean {
  return !ENVIRONMENT_EXEMPT.some((path) => new URL(url).pathname.includes(path))
}

/**
 * Builds the SDK client the browser uses.
 *
 * Note what is *not* passed: `security`. The published SDK types its security
 * as `{ apiKeyAuth: string }`, and a Flexprice API key in a browser bundle is a
 * key handed to every visitor. The browser authenticates as the signed-in user,
 * so the JWT and the environment go on as headers through a `beforeRequest`
 * hook instead.
 *
 * (The backend's `.speakeasy/overlays/typescript-auth.yaml` already declares
 * `BearerAuth` + `EnvironmentId` schemes for exactly this. They are not in the
 * published 2.1.30 build yet. When they land, this hook becomes the SDK's own
 * typed `security` option and this comment should go with it.)
 */
export function createFlexpriceClient({
  serverURL,
  auth,
  onUnauthorized,
  fetcher,
}: ClientOptions): Flexprice {
  const httpClient = new HTTPClient(fetcher ? { fetcher } : {})

  httpClient.addHook('beforeRequest', async (request) => {
    // A Request's headers are immutable once it exists, so build a new one.
    const headers = new Headers(request.headers)

    const token = await auth.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    if (needsEnvironment(request.url)) {
      const environmentId = await auth.getEnvironmentId()
      if (environmentId) headers.set('X-Environment-ID', environmentId)
    }

    return new Request(request, { headers })
  })

  httpClient.addHook('response', (response) => {
    if (response.status === 401) onUnauthorized?.()
  })

  return new Flexprice({ serverURL, httpClient })
}

/**
 * Runs an SDK call and normalizes whatever it throws.
 *
 * TanStack Query and every error boundary above it are built around promises
 * that reject with something consistent. Wrapping here means no caller repeats
 * the same `instanceof FlexPriceError` branch, and no SDK error class leaks
 * past this package.
 */
export async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    throw toApiError(cause)
  }
}
