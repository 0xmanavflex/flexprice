/**
 * A usage event exactly as it arrived, for the Events Debugger.
 *
 * This is the ingest record, not a billed quantity: it says what a customer's
 * system sent and when, so a bill can be traced back to what caused it. The
 * `properties` bag is whatever the sender attached: the debugger shows it
 * verbatim, so it stays `unknown` values rather than being interpreted here.
 */
export interface RawEvent {
  id: string
  eventName: string
  /** The customer's id in the sender's system. Empty when the event carried none. */
  externalCustomerId: string
  /** Flexprice's own customer id, once the event was matched. Empty when it was not. */
  customerId: string
  source: string
  /** When the sender says it happened. `null` when absent or unparseable. */
  timestamp: Date | null
  properties: Record<string, unknown>
}

/**
 * How far back the debugger looks. The server reads only the last 7 days when
 * a request names no window, so the list always sends one.
 */
export type RawEventPeriod = '24h' | '7d' | '30d' | '90d' | '12m'

export const RAW_EVENT_PERIODS: { id: RawEventPeriod; label: string }[] = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
]

/** When a period starts, counted back from `now`. */
export function rawEventPeriodStart(period: RawEventPeriod, now: Date = new Date()): Date {
  const start = new Date(now)
  if (period === '24h') start.setUTCHours(start.getUTCHours() - 24)
  else if (period === '12m') start.setUTCFullYear(start.getUTCFullYear() - 1)
  else start.setUTCDate(start.getUTCDate() - Number.parseInt(period, 10))
  return start
}

export interface RawEventQuery {
  page: number
  pageSize: number
  /** Matched against the event name, server-side. */
  search: string
  /** The sender's customer id. Exact match, server-side. */
  customer: string
  source: string
  /** Newest first by default: a debugger is asked "what just happened". */
  sortDirection: 'asc' | 'desc'
  /** How far back to look. */
  period: RawEventPeriod
}

export const DEFAULT_RAW_EVENT_QUERY: RawEventQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  customer: '',
  source: '',
  sortDirection: 'desc',
  period: '30d',
}
