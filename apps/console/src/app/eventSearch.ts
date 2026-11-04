import { DEFAULT_RAW_EVENT_QUERY, RAW_EVENT_PERIODS, type RawEventQuery } from '@fp/domain'

/**
 * The Events Debugger query, as URL search params.
 *
 * Total, like every list codec here: a filtered list is a shareable link, and
 * a hand-edited URL shows the first page rather than an error.
 */
const MAX_PAGE_SIZE = 100

function param(raw: Record<string, unknown>, short: string, long: string): unknown {
  const value = raw[short]
  return value === undefined || value === null ? raw[long] : value
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.trunc(parsed), max)
}

const text = (value: unknown) => String(value ?? '').trim()

export function parseEventSearch(raw: Record<string, unknown>): RawEventQuery {
  return {
    page: positiveInt(raw['page'], DEFAULT_RAW_EVENT_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_RAW_EVENT_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    customer: text(raw['customer']),
    source: text(raw['source']),
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc' ? 'asc' : DEFAULT_RAW_EVENT_QUERY.sortDirection,
    period:
      RAW_EVENT_PERIODS.find((option) => option.id === raw['period'])?.id ??
      DEFAULT_RAW_EVENT_QUERY.period,
  }
}
