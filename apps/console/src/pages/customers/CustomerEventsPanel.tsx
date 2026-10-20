import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useEventDebug, useRawEvents } from '@fp/query'
import {
  CUSTOMER_EVENTS_LIMIT,
  CustomerEventsGrid,
  EventDetailSheet,
  type CustomerEvent,
} from '@fp/ui/pages'
import { toTraceError } from '@/pages/events/EventListPage'
import { subTab } from '@/pages/shared/subTab'

/**
 * A customer's newest ingested events.
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
  const events = useRawEvents({
    page: 1,
    pageSize: CUSTOMER_EVENTS_LIMIT,
    sortDirection: 'desc',
    customer: externalId,
    search: '',
    source: '',
  })
  const [openId, setOpenId] = useState<string | null>(null)
  const selected = events.data?.events.find((event) => event.id === openId) ?? null
  const debug = useEventDebug(selected)
  const navigate = useNavigate()

  return (
    <>
      <CustomerEventsGrid
        events={(events.data?.events ?? []).map(toCustomerEvent)}
        total={events.data?.total}
        onOpenEvent={setOpenId}
        {...subTab(events, 'events')}
      />
      <EventDetailSheet
        event={selected}
        onClose={() => setOpenId(null)}
        debug={debug.data}
        debugPending={debug.isPending}
        debugError={debug.error ? toTraceError(debug.error) : null}
        onRetryDebug={debug.refetch}
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
    properties: Object.fromEntries(
      Object.entries(event.properties).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : (JSON.stringify(value) ?? ''),
      ]),
    ),
  }
}
