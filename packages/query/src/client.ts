import { QueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind } from '@fp/api'

/**
 * Defaults that stop the UI arguing with the API.
 *
 * The retry policy is the payoff from normalizing errors in `@fp/api`: because
 * every rejection is an `ApiError` carrying a `kind`, the client can tell a
 * flaky network from a refusal. Retrying a 403 three times cannot succeed — it
 * just makes the user wait three times longer to be told no, and triples the
 * load on an endpoint that is already saying no.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (!error.retryable) return false
  return failureCount < 3
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Billing data changes on the server, not in this tab. A short window
        // keeps a back-navigation instant without showing yesterday's invoice.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        throwOnError: (error) =>
          error instanceof ApiError && error.kind === ErrorKind.Server,
      },
      mutations: {
        // A write is not idempotent unless the API says so. Retrying a failed
        // "charge the customer" is how a customer gets charged twice.
        retry: false,
      },
    },
  })
}
