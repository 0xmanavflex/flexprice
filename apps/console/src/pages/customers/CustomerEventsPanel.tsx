import { useRawEvents } from '@fp/query'
import { CUSTOMER_EVENTS_LIMIT, CustomerEventsGrid, type CustomerEvent } from '@fp/ui/pages'
import { subTab } from '@/pages/shared/subTab'

/**
 * A customer's newest ingested events.
 *
 * Mounted only while the Events tab is open, so the read waits until someone
 * looks, and only with a real external id: an empty id would drop the customer
 * filter and list every customer's events under this one.
 */
export function CustomerEventsPanel({ externalId }: { externalId: string }) {
  const events = useRawEvents({
    page: 1,
    pageSize: CUSTOMER_EVENTS_LIMIT,
    sortDirection: 'desc',
    customer: externalId,
    search: '',
    source: '',
  })

  return (
    <CustomerEventsGrid
      events={(events.data?.events ?? []).map(toCustomerEvent)}
      total={events.data?.total}
      {...subTab(events, 'events')}
    />
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
    properties: Object.fromEntries(
      Object.entries(event.properties).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : (JSON.stringify(value) ?? ''),
      ]),
    ),
  }
}
