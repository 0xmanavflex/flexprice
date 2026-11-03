import { setRawUnauthorizedHandler } from './unauthorized'
import { type Fetcher, Flexprice, FlexPriceError, HTTPClient } from '@flexprice/sdk'
import { toApiError } from './errors'
import { DEFAULT_REQUEST_TIMEOUT_MS, withTimeout } from './timeout'

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
  /**
   * Called when a credential is rejected with a 401, so the app can end the
   * session in exactly one place. Called once per rejected credential: a screen
   * firing a dozen parallel requests with one expired token reports it once,
   * not a dozen times.
   */
  onUnauthorized?: () => void
  /**
   * How long a request may wait for the API to start answering before it fails
   * as a `Timeout`. Defaults to 20 seconds; `0` disables the deadline.
   */
  timeoutMs?: number
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
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  fetcher,
}: ClientOptions): Flexprice {
  // Every request goes through the deadline, including ones from a test's stub.
  const base: Fetcher = fetcher ?? ((input, init) => fetch(input, init))
  const httpClient = new HTTPClient({ fetcher: withTimeout(base, timeoutMs) })

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

  /*
   * A burst of parallel requests carrying one expired token all come back 401,
   * and ending the session once is enough — a second sign-out would race the
   * redirect already under way. The credential that was rejected is the dedupe
   * key, so signing in again (a different token) re-arms it.
   */
  let rejectedCredential: string | undefined
  const reject = (credential: string) => {
    if (credential === rejectedCredential) return
    rejectedCredential = credential
    onUnauthorized?.()
  }
  httpClient.addHook('response', (response, request) => {
    if (response.status !== 401) return
    reject(request.headers.get('Authorization') ?? '')
  })
  setRawUnauthorizedHandler(reject)

  return new Flexprice({ serverURL, httpClient })
}

/** What an SDK method accepts as its last argument that this layer fills in. */
export interface CallOptions {
  signal?: AbortSignal
}

/**
 * Runs an SDK call and normalizes whatever it throws.
 *
 * TanStack Query and every error boundary above it are built around promises
 * that reject with something consistent. Wrapping here means no caller repeats
 * the same `instanceof FlexPriceError` branch, and no SDK error class leaks
 * past this package.
 *
 * Pass the query context's `signal` as the second argument and hand the
 * options the operation receives to the SDK method, and a query that is
 * cancelled — a filter changed, a page unmounted — cancels its request instead
 * of leaving it to finish for nobody. The rejection is `ErrorKind.Cancelled`,
 * which TanStack Query discards.
 *
 *     queryFn: ({ signal }) => call((options) => client.customers.getCustomer(id, options), signal)
 */
export async function call<T>(
  operation: (options: CallOptions) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await operation(signal ? { signal } : {})
  } catch (cause) {
    throw toApiError(cause)
  }
}

/**
 * `call` for a write whose response the caller does not read.
 *
 * Some endpoints answer a successful write with a body the SDK cannot parse
 * (an empty body, or a shape the generated schema has not caught up with). The
 * write happened, but `call` reports it as a version mismatch, and the form
 * shows an error for a save that worked. Here a 2xx the SDK rejected resolves
 * as done. Any other failure, and every non-2xx, still rejects as `call` does.
 *
 * Only for callers that refetch instead of reading the result; one that needs
 * the created record must use `call` and see the mismatch.
 */
export async function callWrite(
  operation: (options: CallOptions) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await operation(signal ? { signal } : {})
  } catch (cause) {
    // A 2xx the SDK could not read (a body its schema rejects, or none at
    // all): both surface as a FlexPriceError carrying the successful status.
    if (cause instanceof FlexPriceError && cause.statusCode >= 200 && cause.statusCode < 300) {
      return
    }
    throw toApiError(cause)
  }
}
