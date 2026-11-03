import {
  DEFAULT_PLAN_QUERY,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
  PlanView,
  PLAN_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The plan query, as URL search params.
 *
 * Same rule as features and invoices: the route owns the query, so a filtered
 * list is a shareable link and the grid stays stateless. Parsing is total: a
 * hand-edited URL shows the first page rather than an error.
 */
const STATUSES = new Set<string>(Object.values(PlanStatus))
const SORT_FIELDS = new Set<string>(Object.values(PlanSortField))
const MAX_PAGE_SIZE = 100

/** A param under either spelling: the short hand-typed one, or the long one TanStack writes. */
function param(raw: Record<string, unknown>, short: string, long: string): unknown {
  const value = raw[short]
  return value === undefined || value === null ? raw[long] : value
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.trunc(parsed), max)
}

export function parsePlanSearch(raw: Record<string, unknown>): PlanQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is PlanStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_PLAN_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_PLAN_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? ''),
    statuses: [...new Set(statuses)],
    sortBy: SORT_FIELDS.has(String(param(raw, 'sort', 'sortBy')))
      ? (String(param(raw, 'sort', 'sortBy')) as PlanSortField)
      : DEFAULT_PLAN_QUERY.sortBy,
    sortDirection:
      param(raw, 'dir', 'sortDirection') === 'asc' ? 'asc' : DEFAULT_PLAN_QUERY.sortDirection,
    // A layout, not a filter. `cards` persists; anything else is the table.
    view: param(raw, 'view', 'view') === PlanView.Cards ? PlanView.Cards : PlanView.Table,
    filters: runnableFilters(decodeListFilters(raw['filters']), PLAN_FILTERS),
  }
}
