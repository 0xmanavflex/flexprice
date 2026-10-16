import { ApiError, describeFreshness, ErrorKind } from '@fp/query'

/**
 * The slice of a TanStack query result the dashboards' shapers read. Declared
 * here rather than importing `UseQueryResult` so the console does not take a
 * direct dependency on the query library's types for a handful of fields.
 */
export interface QueryView<T> {
  data: T | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  isFetching: boolean
  isPlaceholderData: boolean
  dataUpdatedAt: number
  refetch: () => unknown
}

/** What every panel says about the quality of its figures. Structurally `PanelMeta` and `RevenuePanelMeta`. */
export interface PanelQuality {
  onRetry: () => void
  isRetrying: boolean
  refreshing: boolean
  provisional: boolean
  stale: boolean
  updatedAt: number | undefined
}

/**
 * A failure worth showing. A cancelled request is the browser abandoning a
 * fetch (navigation, a superseded filter), not the server failing, so it is
 * never rendered as an error.
 */
export function failed(view: QueryView<unknown>): boolean {
  return (
    view.isError && !(view.error instanceof ApiError && view.error.kind === ErrorKind.Cancelled)
  )
}

/**
 * Derived the same way for every panel (see `describeFreshness`): data on
 * screen beats a spinner or an error.
 *
 *   - refreshing: a request is in flight and the panel is not first-loading.
 *   - provisional: the figures are the previous window's, held while the new
 *     ones load (`placeholderData`). They are dimmed, never passed off as current.
 *   - stale: the last refresh failed and the figures are the previous good copy.
 */
export function qualityOf(view: QueryView<unknown>): PanelQuality {
  const freshness = describeFreshness(view)
  return {
    onRetry: () => {
      void view.refetch()
    },
    isRetrying: view.isFetching,
    refreshing: freshness.refreshing,
    provisional: freshness.provisional,
    stale: freshness.stale && failed(view),
    updatedAt: view.data !== undefined && freshness.updatedAt > 0 ? freshness.updatedAt : undefined,
  }
}

/** No data yet: a real error is unavailable, anything else is still loading. */
export function withoutData(view: QueryView<unknown>): 'unavailable' | 'loading' {
  return failed(view) ? 'unavailable' : 'loading'
}
