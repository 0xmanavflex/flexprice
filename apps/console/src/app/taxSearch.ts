import {
  type TaxRateQuery,
  TaxRateSortField,
  TaxRateStatus,
  DEFAULT_TAX_RATE_QUERY,
} from '@fp/domain'

/**
 * The tax-rate query, as URL search params.
 *
 * The same total, both-spellings parser the catalogue lists use: a filtered
 * list is a shareable link, and a hand-edited URL shows the first page rather
 * than an error.
 */
const STATUSES = new Set<string>(Object.values(TaxRateStatus))
const SORT_FIELDS = new Set<string>(Object.values(TaxRateSortField))
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

export function parseTaxSearch(raw: Record<string, unknown>): TaxRateQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is TaxRateStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_TAX_RATE_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_TAX_RATE_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as TaxRateSortField)
      : DEFAULT_TAX_RATE_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc' ? 'asc' : DEFAULT_TAX_RATE_QUERY.sortDirection,
  }
}
