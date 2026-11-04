import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { rawEventPeriodStart, type RawEvent, type RawEventQuery } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Raw events: the ingest log, through `POST /events/query`
 * (`client.events.listRawEvents`).
 *
 * The event name, customer and source are all server-side filters here, so
 * unlike the catalogue lists nothing is narrowed on the page.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface RawEventWire {
  id?: string | undefined
  eventName?: string | undefined
  externalCustomerId?: string | undefined
  customerId?: string | undefined
  source?: string | undefined
  timestamp?: string | undefined
  properties?: Record<string, unknown> | undefined
}

export function toRawEvent(wire: RawEventWire): RawEvent {
  const parsed = wire.timestamp ? new Date(wire.timestamp) : null
  return {
    id: wire.id ?? '',
    eventName: wire.eventName ?? '',
    externalCustomerId: wire.externalCustomerId ?? '',
    customerId: wire.customerId ?? '',
    source: wire.source ?? '',
    timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    properties: wire.properties ?? {},
  }
}

/**
 * A page of the list, as the request takes it. Only the filters that were set
 * are sent; the SDK drops undeclared keys anyway. A period becomes a window
 * ending `now`: without one the server reads only the last 7 days.
 */
export function toRawEventFilter(
  query: RawEventRead,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    pageSize: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    order: query.sortDirection,
    ...(query.period ? { startTime: rawEventPeriodStart(query.period, now), endTime: now } : {}),
    ...(query.search ? { eventName: query.search } : {}),
    ...(query.customer ? { externalCustomerId: query.customer } : {}),
    ...(query.source ? { source: query.source } : {}),
  }
}

/** The list's query; a read without a period takes the server's own window. */
export type RawEventRead = Omit<RawEventQuery, 'period'> & Partial<Pick<RawEventQuery, 'period'>>

export interface RawEventPage {
  events: RawEvent[]
  total: number
}

export async function fetchRawEvents(
  client: Flexprice,
  query: RawEventRead,
): Promise<RawEventPage> {
  const response = await call(() => client.events.listRawEvents(toRawEventFilter(query) as never))
  const events = (response.events ?? []).map((event) => toRawEvent(event as RawEventWire))
  return { events, total: response.totalCount ?? events.length }
}

export function useRawEvents(query: RawEventQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.rawEvents.list({ ...query }),
    queryFn: () => fetchRawEvents(client, query),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  })
}

/**
 * The same read, a page at a time, for a list that grows as it is scrolled
 * (a customer's Events tab). Pages are fetched in order; there is a next one
 * while the last came back full and fewer than the total have been loaded.
 */
export function useRawEventsInfinite(query: Omit<RawEventRead, 'page'>) {
  const client = useFlexprice()

  return useInfiniteQuery({
    queryKey: [...queryKeys.rawEvents.list({ ...query }), 'infinite'] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchRawEvents(client, { ...query, page: pageParam }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.events.length, 0)
      return last.events.length === query.pageSize && loaded < last.total
        ? pages.length + 1
        : undefined
    },
  })
}
