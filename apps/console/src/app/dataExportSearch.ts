import { DEFAULT_DATA_EXPORT_QUERY, EXPORT_STATE, type DataExportQuery } from '@fp/domain'

/**
 * The exports query, as URL search params. Total, like every list codec here:
 * a hand-edited URL shows the first page rather than an error.
 */
const STATES = new Set<string>(Object.values(EXPORT_STATE))
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

export function parseDataExportSearch(raw: Record<string, unknown>): DataExportQuery {
  const state = String(param(raw, 'status', 'state') ?? '')

  return {
    page: positiveInt(raw['page'], DEFAULT_DATA_EXPORT_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_DATA_EXPORT_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? '').trim(),
    state: STATES.has(state)
      ? (state as DataExportQuery['state'])
      : DEFAULT_DATA_EXPORT_QUERY.state,
  }
}
