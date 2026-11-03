import {
  type AddonQuery,
  AddonSortField,
  AddonStatus,
  AddonView,
  DEFAULT_ADDON_QUERY,
  ADDON_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The add-on query, as URL search params.
 *
 * The same total, both-spellings parser as features and plans: a filtered list
 * is a shareable link, and a hand-edited URL shows the first page rather than an
 * error.
 */
const STATUSES = new Set<string>(Object.values(AddonStatus))
const SORT_FIELDS = new Set<string>(Object.values(AddonSortField))
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

export function parseAddonSearch(raw: Record<string, unknown>): AddonQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is AddonStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_ADDON_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_ADDON_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as AddonSortField)
      : DEFAULT_ADDON_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc' ? 'asc' : DEFAULT_ADDON_QUERY.sortDirection,
    view: param(raw, 'view', 'view') === AddonView.Cards ? AddonView.Cards : AddonView.Table,
    filters: runnableFilters(decodeListFilters(raw['filters']), ADDON_FILTERS),
  }
}
