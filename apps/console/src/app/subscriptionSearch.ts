import {
  type SubscriptionQuery,
  SubscriptionSortField,
  SubscriptionStatus,
  DEFAULT_SUBSCRIPTION_QUERY,
  SUBSCRIPTION_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The subscription query, as URL search params.
 *
 * The same total, both-spellings parser as coupons and add-ons: a filtered list
 * is a shareable link, and a hand-edited URL shows the first page rather than an
 * error. There is no `view`: the list is one table: and the default sort is
 * newest-started first.
 */
const STATUSES = new Set<string>(Object.values(SubscriptionStatus))
const SORT_FIELDS = new Set<string>(Object.values(SubscriptionSortField))
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

export function parseSubscriptionSearch(raw: Record<string, unknown>): SubscriptionQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is SubscriptionStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_SUBSCRIPTION_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_SUBSCRIPTION_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? '').trim(),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as SubscriptionSortField)
      : DEFAULT_SUBSCRIPTION_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc'
        ? 'asc'
        : DEFAULT_SUBSCRIPTION_QUERY.sortDirection,
    filters: runnableFilters(decodeListFilters(raw['filters']), SUBSCRIPTION_FILTERS),
  }
}
