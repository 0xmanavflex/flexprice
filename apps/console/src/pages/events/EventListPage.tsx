import { useState } from 'react'
import { type RawEvent, type RawEventQuery } from '@fp/domain'
import {
  ApiError,
  ErrorKind,
  serverReason,
  useCustomerNames,
  useEventDebug,
  useFeatureNames,
  useRawEvents,
} from '@fp/query'
import { EventDetailSheet, EventGrid } from '@fp/ui/pages'
import {
  DataFreshness,
  EMPTY_CATALOGUE,
  ListState,
  PageBody,
  resolveDataState,
} from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface EventListPageProps {
  query: RawEventQuery
  onQueryChange: (query: RawEventQuery) => void
  /** Opens a contract the opened event was matched to. */
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  onOpenFeature?: ((featureId: string) => void) | undefined
}

/**
 * A failed trace, as a sentence.
 *
 * 404 is the common one and is not really an error: the backend searches a
 * window around the event and says so, which is worth repeating rather than
 * flattening into "not found".
 */
export function toTraceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === ErrorKind.NotFound) {
      return (
        serverReason(error) ??
        'This event is outside the window the trace searches. It may be too old to trace.'
      )
    }
    return serverReason(error) ?? 'Could not trace this event. Try again.'
  }
  return 'Could not trace this event. Try again.'
}

/** Anything in the query that narrows the list. The one place that decides it. */
function isEventQueryFiltered(query: RawEventQuery): boolean {
  return query.search.length > 0 || query.customer.length > 0 || query.source.length > 0
}

/**
 * The wiring layer for the Events Debugger: fetch, turn an error into a
 * sentence, hand the grid plain props. The query lives in the URL; the opened
 * event is ephemeral, so it is the one piece of local state.
 *
 * One loading path: `ListState` owns the first load, a failure and the refresh
 * cue, and the grid underneath is handed `isLoading={false}` so the two never
 * both draw a loader. Rows already on screen stay through a refetch, a page
 * change and a failed refresh.
 */
export function EventListPage({
  query,
  onQueryChange,
  onOpenSubscription,
  onOpenFeature,
}: EventListPageProps) {
  const events = useRawEvents(query)
  const [selected, setSelected] = useState<RawEvent | null>(null)
  /*
   * The trace, read only while a sheet is open.
   *
   * `useEventDebug` disables itself when `selected` is null, so closing the
   * sheet stops the request rather than leaving a five-stage server-side
   * lookup running for a row nobody is looking at.
   */
  const debug = useEventDebug(selected)
  const processed = debug.data?.processedUsage ?? []
  const customerNames = useCustomerNames(processed.map((usage) => usage.customerId))
  const featureNames = useFeatureNames(processed.map((usage) => usage.featureId))

  const rows = events.data?.events ?? []
  const hasData = events.data !== undefined
  const isFiltered = isEventQueryFiltered(query)
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', customer: '', source: '', page: 1 })

  const state = resolveDataState({
    hasData,
    isPending: events.isPending,
    isFetching: events.isFetching,
    isError: events.isError,
    isPlaceholderData: events.isPlaceholderData,
    isEmpty: hasData && rows.length === 0,
    isFiltered,
  })
  const failure = toListFailure(events.error, 'events')
  const copy = EMPTY_CATALOGUE.events

  return (
    <PageBody>
      <ListState
        isLoading={state.kind === 'loading'}
        // A failed refresh over rows on screen is said by `DataFreshness` below;
        // only a failure with nothing to show takes the list's place.
        error={rows.length > 0 ? null : failure}
        {...(failure ? { failureKind: failure.kind } : {})}
        isRetrying={events.isFetching && events.isError}
        hasRows={rows.length > 0}
        isRefreshing={state.refreshing}
        isProvisional={state.provisional}
        isEmpty={hasData && rows.length === 0}
        isFiltered={isFiltered}
        onRetry={() => void events.refetch()}
        onClearFilters={clearFilters}
        emptyTitle={copy.title}
        emptyDescription={copy.description}
      >
        {hasData ? (
          <div className="flex justify-end">
            <DataFreshness
              updatedAt={events.dataUpdatedAt}
              refreshing={events.isFetching}
              stale={state.stale}
              onRefresh={() => void events.refetch()}
            />
          </div>
        ) : null}
        <EventGrid
          events={rows}
          total={events.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onEventClick={setSelected}
          onClearFilters={clearFilters}
          onReload={() => void events.refetch()}
          isReloading={events.isFetching}
        />
      </ListState>
      <EventDetailSheet
        event={selected}
        onClose={() => setSelected(null)}
        debug={debug.data}
        debugPending={debug.isPending}
        debugError={debug.error ? toTraceError(debug.error) : null}
        onRetryDebug={debug.refetch}
        customerNames={customerNames.data}
        featureNames={featureNames.data}
        {...(onOpenSubscription ? { onOpenSubscription } : {})}
        {...(onOpenFeature ? { onOpenFeature } : {})}
      />
    </PageBody>
  )
}
