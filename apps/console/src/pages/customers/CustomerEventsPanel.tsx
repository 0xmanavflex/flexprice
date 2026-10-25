import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCustomerNames, useEventDebug, useFeatureNames, useRawEventsInfinite } from '@fp/query'
import {
  CUSTOMER_EVENTS_LIMIT,
  CustomerEventsGrid,
  EventDetailSheet,
  type CustomerEvent,
} from '@fp/ui/pages'
import { toTraceError } from '@/pages/events/EventListPage'
import { toListFailure } from '@/pages/shared/listFailure'
import { subTab } from '@/pages/shared/subTab'

/**
 * A customer's ingested events, newest first, loaded a page at a time as the
 * list is scrolled.
 *
 * Mounted only while the Events tab is open, so the read waits until someone
 * looks, and only with a real external id: an empty id would drop the customer
 * filter and list every customer's events under this one.
 *
 * Opening a row shows the same detail as the Events debugger: the five-stage
 * trace, where the event was billed (processed usage), its payload and every
 * ingested version. The trace is read only while the sheet is open.
 */
export function CustomerEventsPanel({ externalId }: { externalId: string }) {
  const events = useRawEventsInfinite({
    pageSize: CUSTOMER_EVENTS_LIMIT,
    sortDirection: 'desc',
    customer: externalId,
    search: '',
    source: '',
  })
  const [openId, setOpenId] = useState<string | null>(null)
  // Kept stable across renders: the grid restarts a rate limit's cooldown
  // when this changes, so it must change only with the failure itself.
  const failedNextPage = events.isFetchNextPageError
  const loadMoreError = useMemo(
    () => (failedNextPage ? toListFailure(events.error, 'more events') : null),
    [failedNextPage, events.error],
  )
  const loaded = events.data?.pages.flatMap((page) => page.events) ?? []
  const selected = loaded.find((event) => event.id === openId) ?? null
  const debug = useEventDebug(selected)
  const processed = debug.data?.processedUsage ?? []
  const customerNames = useCustomerNames(processed.map((usage) => usage.customerId))
  const featureNames = useFeatureNames(processed.map((usage) => usage.featureId))
  const navigate = useNavigate()

  return (
    <>
      <CustomerEventsGrid
        events={loaded.map(toCustomerEvent)}
        total={events.data?.pages[0]?.total}
        onOpenEvent={setOpenId}
        onRefresh={() => void events.refetch()}
        isRefreshing={events.isFetching && !events.isPending && !events.isFetchingNextPage}
        onLoadMore={() => void events.fetchNextPage()}
        hasMore={events.hasNextPage}
        isLoadingMore={events.isFetchingNextPage}
        loadMoreError={loadMoreError}
        // A later page failing keeps the events already shown; only a failed
        // first read is the tab's error.
        {...subTab({ ...events, error: events.data ? null : events.error }, 'events')}
      />
      <EventDetailSheet
        event={selected}
        onClose={() => setOpenId(null)}
        debug={debug.data}
        debugPending={debug.isPending}
        debugError={debug.error ? toTraceError(debug.error) : null}
        onRetryDebug={debug.refetch}
        customerNames={customerNames.data}
        featureNames={featureNames.data}
        onOpenSubscription={(subscriptionId) =>
          void navigate({ to: '/contracts/$subscriptionId', params: { subscriptionId } })
        }
        onOpenFeature={(featureId) =>
          void navigate({ to: '/features/$featureId', params: { featureId } })
        }
      />
    </>
  )
}
/** An ingested event, as the events grid shows it. */
function toCustomerEvent(event: {
  id: string
  eventName: string
  source: string
  timestamp: Date | null
  properties: Record<string, unknown>
}): CustomerEvent {
  return {
    id: event.id,
    name: event.eventName || 'Unnamed event',
    source: event.source,
    receivedAt: event.timestamp
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          event.timestamp,
        )
      : '',
    receivedAtMs: event.timestamp?.getTime() ?? 0,
    properties: Object.fromEntries(
      Object.entries(event.properties).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : (JSON.stringify(value) ?? ''),
      ]),
    ),
  }
}
