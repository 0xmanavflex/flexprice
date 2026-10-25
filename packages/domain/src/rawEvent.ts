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
}

export const DEFAULT_RAW_EVENT_QUERY: RawEventQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  customer: '',
  source: '',
  sortDirection: 'desc',
}
