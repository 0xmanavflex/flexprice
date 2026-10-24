import {
  DEFAULT_FEATURE_QUERY,
  type FeatureQuery,
  FeatureSortField,
  FeatureStatus,
  FeatureType,
  FeatureView,
  FEATURE_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The feature query, as URL search params.
 *
 * Same rule as invoices: the route owns the query, so a filtered list is a
 * shareable link and the grid stays stateless. Parsing is total — a hand-edited
 * URL shows the first page rather than an error.
 */
const TYPES = new Set<string>(Object.values(FeatureType))
const STATUSES = new Set<string>(Object.values(FeatureStatus))
const SORT_FIELDS = new Set<string>(Object.values(FeatureSortField))
const MAX_PAGE_SIZE = 100

/**
 * A param under either spelling.
 *
 * The short names are what a person writes by hand — `?q=api&type=metered`
 * beats `?search=api&types=%5B%22metered%22%5D`. The long names are what
 * TanStack writes, because it serialises the query object as it stands.
 *
 * Reading both is what makes the round trip work. Reading only the short ones
 * meant every filter and sort reverted the instant it was applied: navigate
 * wrote `types`, the parser looked for `type`, found nothing, and returned the
 * default — with no error anywhere.
 */
function param(raw: Record<string, unknown>, short: string, long: string): unknown {
  const value = raw[short]
  return value === undefined || value === null ? raw[long] : value
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.trunc(parsed), max)
}

export function parseFeatureSearch(raw: Record<string, unknown>): FeatureQuery {
  const rawTypes = param(raw, 'type', 'types')
  const types = (Array.isArray(rawTypes) ? rawTypes : String(rawTypes ?? '').split(','))
    .map((t) => String(t).trim())
    .filter((t): t is FeatureType => TYPES.has(t))

  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is FeatureStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_FEATURE_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_FEATURE_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? '').trim(),
    types: [...new Set(types)],
    statuses: [...new Set(statuses)],
    // Unknown values fall back rather than throwing: a hand-edited URL should
    // show the default list, not an error page.
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as FeatureSortField)
      : DEFAULT_FEATURE_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'desc' ? 'desc' : DEFAULT_FEATURE_QUERY.sortDirection,
    // A layout, not a filter. `cards` persists; anything else is the table.
    view: param(raw, 'view', 'view') === FeatureView.Cards ? FeatureView.Cards : FeatureView.Table,
    // No `filters` param is the default view (published features); an explicit
    // empty list is "every status", so removing the chip sticks across reloads.
    filters:
      raw['filters'] === undefined
        ? (DEFAULT_FEATURE_QUERY.filters ?? [])
        : runnableFilters(decodeListFilters(raw['filters']), FEATURE_FILTERS),
  }
}
