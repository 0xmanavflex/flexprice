/**
 * The state model every data-driven surface is described by.
 *
 * One pure function so "which state is this?" has a single answer instead of
 * eleven `isLoading ? … : error ? … : …` ladders that disagree on order. The
 * order is the policy:
 *
 *   1. Data already on screen always wins over a spinner or an error. A failed
 *      or slow refetch must not take away something that was true a moment ago;
 *      it is shown as `stale` or `refreshing` instead.
 *   2. With nothing to show, an error beats loading (a failed refetch must not
 *      hide behind a skeleton) and loading beats empty (never say "nothing here"
 *      before the server has answered).
 *   3. Empty is two different facts: nothing exists, or the filter excludes it:
 *      and they get different screens.
 *
 * The input is structural, so it fits a TanStack query result without `@fp/ui`
 * depending on TanStack.
 */
export interface DataStateInput {
  /** The surface has something it can render: real data, or placeholder from the previous input. */
  hasData: boolean
  /** No data has ever resolved for this input. */
  isPending: boolean
  /** A request is in flight, including a background refetch. */
  isFetching: boolean
  isError: boolean
  /** The data shown belongs to the previous input (page, filter) while the next loads. */
  isPlaceholderData?: boolean
  /** The request succeeded and the result has no records. */
  isEmpty?: boolean
  /** A search, filter or date range is responsible for there being no records. */
  isFiltered?: boolean
}

export type DataStateKind = 'loading' | 'error' | 'empty' | 'filtered' | 'ready'

export interface DataState {
  kind: DataStateKind
  /** Content is on screen and a request is updating it. Show a quiet cue, not a skeleton. */
  refreshing: boolean
  /** Content is on screen but the latest attempt to update it failed. Say so; keep the content. */
  stale: boolean
  /** Content is from the previous input. It must not be read as the answer to the current one. */
  provisional: boolean
}

export function resolveDataState(input: DataStateInput): DataState {
  const { hasData, isPending, isFetching, isError, isPlaceholderData = false } = input

  if (!hasData) {
    const kind: DataStateKind = isError ? 'error' : isPending ? 'loading' : 'ready'
    return { kind, refreshing: false, stale: false, provisional: false }
  }

  const kind: DataStateKind = input.isEmpty ? (input.isFiltered ? 'filtered' : 'empty') : 'ready'

  return {
    kind,
    refreshing: isFetching && !isError,
    stale: isError,
    provisional: isPlaceholderData,
  }
}
