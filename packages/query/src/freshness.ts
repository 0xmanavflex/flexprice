/**
 * What a query's state means to a person looking at it.
 *
 * TanStack exposes five overlapping booleans; a page that reads them directly
 * ends up with a different opinion on each screen. This collapses them into the
 * three things worth saying, so every list reports "refreshing", "stale" and
 * "provisional" the same way.
 */
export interface Freshness {
  /** Showing data while a fetch is running. Not the first load. */
  refreshing: boolean
  /** The last fetch failed but earlier data is still on screen. Say so; keep the rows. */
  stale: boolean
  /** The rows are the previous page or filter standing in for the one loading. */
  provisional: boolean
  /** When the data was last fetched successfully, ms since epoch; 0 if never. */
  updatedAt: number
}

/** The slice of a TanStack query result this reads. */
export interface FreshnessSource {
  isFetching: boolean
  isPending: boolean
  isError: boolean
  isPlaceholderData: boolean
  data: unknown
  dataUpdatedAt: number
}

export function describeFreshness(query: FreshnessSource): Freshness {
  return {
    refreshing: query.isFetching && !query.isPending,
    stale: query.isError && query.data !== undefined,
    provisional: query.isPlaceholderData,
    updatedAt: query.dataUpdatedAt,
  }
}
