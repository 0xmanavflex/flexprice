import {
  BILLING_ENTITY_FILTER,
  type PaymentQuery,
  PaymentSortField,
  PaymentStatus,
  DEFAULT_PAYMENT_QUERY,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The payment query, as URL search params.
 *
 * The same total, both-spellings parser the catalogue lists use: a filtered
 * list is a shareable link, and a hand-edited URL shows the first page rather
 * than an error. There is no `view`: a payment is only ever a row.
 */
const STATUSES = new Set<string>(Object.values(PaymentStatus))
const SORT_FIELDS = new Set<string>(Object.values(PaymentSortField))
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

export function parsePaymentSearch(raw: Record<string, unknown>): PaymentQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is PaymentStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_PAYMENT_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_PAYMENT_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as PaymentSortField)
      : DEFAULT_PAYMENT_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc' ? 'asc' : DEFAULT_PAYMENT_QUERY.sortDirection,
    // Kept here; the list sends it only while entities are enabled.
    filters: runnableFilters(decodeListFilters(raw['filters']), [BILLING_ENTITY_FILTER]),
  }
}
