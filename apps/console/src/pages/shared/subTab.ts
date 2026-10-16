import type { SubTabQuery } from '@fp/ui/compositions'
import { toListFailure } from './listFailure'

/** The slice of a TanStack query that a sub-tab needs. */
export interface SubTabSource {
  isPending: boolean
  isFetching: boolean
  error: unknown
  refetch: () => unknown
}

/**
 * A sub-query as the view's `SubTabQuery`: a failure never reads as "none", and
 * a pending read is loading rather than empty. `noun` is what was being loaded:
 * "payments", "entitlements".
 */
export function subTab(query: SubTabSource, noun: string): SubTabQuery {
  const failed = toListFailure(query.error, noun)
  return {
    isLoading: query.isPending && !query.error,
    error: failed?.message ?? null,
    errorKind: failed?.kind,
    retryAfterMs: failed?.retryAfterMs,
    onRetry: failed?.canRetry ? () => void query.refetch() : undefined,
    isRetrying: query.isFetching && Boolean(query.error),
  }
}
