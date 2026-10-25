import { type Query, type QueryKey, QueryClient, hashKey } from '@tanstack/react-query'
import { ApiError, ErrorKind } from '@fp/api'

/**
 * Defaults that stop the UI arguing with the API.
 *
 * The retry policy is the payoff from normalizing errors in `@fp/api`: because
 * every rejection is an `ApiError` carrying a `kind`, the client can tell a
 * flaky network from a refusal. Retrying a 403 three times cannot succeed: it
 * just makes the user wait three times longer to be told no, and triples the
 * load on an endpoint that is already saying no.
 *
 * Per kind:
 *
 *   - Network, Server    up to three retries. Either may be a blip.
 *   - Timeout            one retry. A request that already waited the full
 *                        deadline is likely to hang again; a second full wait
 *                        is the most a person should be asked to sit through.
 *   - RateLimited        only when the API said when to come back
 *                        (`Retry-After`), only if that is soon, and at most
 *                        twice. Hammering a limiter earns a longer ban.
 *   - everything else    never. Forbidden, Unauthorized, NotFound, Invalid and
 *                        Cancelled cannot succeed on a second ask.
 */
export const MAX_RETRY_AFTER_MS = 30_000

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false

  switch (error.kind) {
    case ErrorKind.RateLimited:
      return (
        error.retryAfterMs !== undefined &&
        error.retryAfterMs <= MAX_RETRY_AFTER_MS &&
        failureCount < 2
      )
    case ErrorKind.Timeout:
      return failureCount < 1
    case ErrorKind.Network:
    case ErrorKind.Server:
      return failureCount < 3
    default:
      return false
  }
}

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8_000

/**
 * How long to wait before the next attempt.
 *
 * Exponential with jitter, so a hundred tabs that lost the same connection do
 * not all come back in the same millisecond. A rate-limited failure waits as
 * long as the API asked, capped so a hostile header cannot park the UI.
 * `random` is a parameter so the schedule is testable.
 */
export function retryDelay(
  failureCount: number,
  error: unknown,
  random: () => number = Math.random,
): number {
  if (error instanceof ApiError && error.kind === ErrorKind.RateLimited) {
    return Math.min(error.retryAfterMs ?? BASE_DELAY_MS, MAX_RETRY_AFTER_MS)
  }
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_DELAY_MS)
  // "Equal jitter": half fixed, half random. Never zero, never the whole ceiling.
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

/**
 * Whether a failed query should be thrown to the nearest error boundary.
 *
 * Only a server fault, and only when there is nothing to show. A background
 * refetch that fails while the screen already holds rows must leave those rows
 * alone: blanking a customer list because a refresh hit a 500 trades true data
 * for an error. The page reads `isError` plus `data` and says "could not
 * refresh" over what it has.
 */
export function shouldThrowOnError(
  error: unknown,
  query: Pick<Query, 'state'> | { state: { data: unknown } },
): boolean {
  return (
    error instanceof ApiError && error.kind === ErrorKind.Server && query.state.data === undefined
  )
}

/**
 * Cache entries that belong to the signed-in user rather than to an
 * environment. Hashing the environment into these would refetch the
 * environment list the moment one is chosen.
 */
const UNSCOPED_ROOTS: ReadonlySet<unknown> = new Set(['session', 'tenant'])

export interface QueryClientOptions {
  /**
   * The environment requests are being sent to, read synchronously.
   *
   * The `X-Environment-ID` header rides on every request but appears in no
   * query key, so without this the sandbox's invoices and production's share
   * one cache entry. It is read where the key is *hashed*, not where it is
   * built: keys keep their shape (prefix invalidation is untouched) and the
   * ~40 call sites need no edit, yet two environments can never collide.
   */
  getEnvironmentId?: () => string | null | undefined
}

/** The hash function for a given environment source. Exported for tests. */
export function createQueryKeyHash(
  getEnvironmentId?: QueryClientOptions['getEnvironmentId'],
): (queryKey: QueryKey) => string {
  return (queryKey) => {
    if (!getEnvironmentId || UNSCOPED_ROOTS.has(queryKey[0])) return hashKey(queryKey)
    return hashKey(['env', getEnvironmentId() ?? null, ...queryKey])
  }
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: (failureCount, error) => retryDelay(failureCount, error),
        queryKeyHashFn: createQueryKeyHash(options.getEnvironmentId),
        // Billing data changes on the server, not in this tab. A short window
        // keeps a back-navigation instant without showing yesterday's invoice.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        throwOnError: shouldThrowOnError,
      },
      mutations: {
        // A write is not idempotent unless the API says so. Retrying a failed
        // "charge the customer" is how a customer gets charged twice.
        retry: false,
      },
    },
  })
}
