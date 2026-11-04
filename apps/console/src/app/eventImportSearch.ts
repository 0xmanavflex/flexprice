import { DEFAULT_EVENT_IMPORT_QUERY, EVENT_IMPORT_STATUS, type EventImportQuery } from '@fp/domain'

/**
 * The imports query, as URL search params. Total, like every list codec here:
 * a hand-edited URL shows the first page rather than an error.
 */
const STATUSES = new Set<string>(Object.values(EVENT_IMPORT_STATUS))
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

export function parseEventImportSearch(raw: Record<string, unknown>): EventImportQuery {
  const status = String(raw['status'] ?? '')

  return {
    page: positiveInt(raw['page'], DEFAULT_EVENT_IMPORT_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_EVENT_IMPORT_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    status: STATUSES.has(status)
      ? (status as EventImportQuery['status'])
      : DEFAULT_EVENT_IMPORT_QUERY.status,
    search: String(param(raw, 'q', 'search') ?? ''),
    open: String(raw['open'] ?? ''),
  }
}
