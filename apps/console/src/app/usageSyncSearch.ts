import { DEFAULT_USAGE_SYNC_QUERY, USAGE_SYNC_STATE, type UsageSyncQuery } from '@fp/domain'

/**
 * The usage sync query, as URL search params. Total, like every list codec
 * here: a hand-edited URL shows the first page rather than an error.
 */
const STATES = new Set<string>(Object.values(USAGE_SYNC_STATE))
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

export function parseUsageSyncSearch(raw: Record<string, unknown>): UsageSyncQuery {
  const state = String(param(raw, 'sync', 'state') ?? '')

  return {
    page: positiveInt(raw['page'], DEFAULT_USAGE_SYNC_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_USAGE_SYNC_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    state: STATES.has(state) ? (state as UsageSyncQuery['state']) : DEFAULT_USAGE_SYNC_QUERY.state,
  }
}
