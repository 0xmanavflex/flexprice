import {
  type PriceUnitQuery,
  PriceUnitSortField,
  PriceUnitStatus,
  PriceUnitView,
  DEFAULT_PRICE_UNIT_QUERY,
  PRICE_UNIT_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The price-unit query, as URL search params.
 *
 * The same total, both-spellings parser as features, plans, add-ons and
 * coupons: a filtered list is a shareable link, and a hand-edited URL shows the
 * first page rather than an error.
 */
const STATUSES = new Set<string>(Object.values(PriceUnitStatus))
const SORT_FIELDS = new Set<string>(Object.values(PriceUnitSortField))
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

export function parsePriceUnitSearch(raw: Record<string, unknown>): PriceUnitQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is PriceUnitStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_PRICE_UNIT_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_PRICE_UNIT_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as PriceUnitSortField)
      : DEFAULT_PRICE_UNIT_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc'
        ? 'asc'
        : DEFAULT_PRICE_UNIT_QUERY.sortDirection,
    view:
      param(raw, 'view', 'view') === PriceUnitView.Cards
        ? PriceUnitView.Cards
        : PriceUnitView.Table,
    filters: runnableFilters(decodeListFilters(raw['filters']), PRICE_UNIT_FILTERS),
  }
}
