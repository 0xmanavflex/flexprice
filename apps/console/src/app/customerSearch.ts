import {
  type CustomerQuery,
  CustomerSortField,
  CustomerStatus,
  CUSTOMER_FILTERS,
  DEFAULT_CUSTOMER_QUERY,
  FilterOp,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The customer query, as URL search params.
 *
 * The same total, both-spellings parser the catalogue lists use: a filtered
 * list is a shareable link, and a hand-edited URL shows the first page rather
 * than an error. No `view`: a billing list is a table, so there is no layout
 * to read off the URL.
 */
const STATUSES = new Set<string>(Object.values(CustomerStatus))
const SORT_FIELDS = new Set<string>(Object.values(CustomerSortField))
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

export function parseCustomerSearch(raw: Record<string, unknown>): CustomerQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is CustomerStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_CUSTOMER_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_CUSTOMER_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? '').trim(),
    // A status link becomes the visible status filter below; the facet is
    // cleared so removing that chip really shows every status.
    statuses: raw['filters'] === undefined ? [] : [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as CustomerSortField)
      : DEFAULT_CUSTOMER_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'desc' ? 'desc' : DEFAULT_CUSTOMER_QUERY.sortDirection,
    // No `filters` param is the default view (active customers); an explicit
    // empty list is "every status", so removing the chip sticks across reloads.
    filters:
      raw['filters'] === undefined
        ? // A link that names a status asks for that status; the default
          // status filter would contradict it, so it is left off.
          statuses.length > 0
          ? [{ field: 'status', op: FilterOp.In, value: [...new Set(statuses)] }]
          : (DEFAULT_CUSTOMER_QUERY.filters ?? [])
        : runnableFilters(decodeListFilters(raw['filters']), CUSTOMER_FILTERS),
  }
}
