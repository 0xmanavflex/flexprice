import {
  BILLING_ENTITY_FILTER,
  DEFAULT_INVOICE_QUERY,
  type InvoiceQuery,
  InvoiceSortField,
  InvoiceStatus,
  INVOICE_FILTERS,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The invoice query, as URL search params.
 *
 * This is the piece that decides whether the grid is a component or an
 * organism. Because the query lives here: in the URL, owned by the route:
 * the grid can stay stateless, a filtered view is a link somebody can send,
 * back and forward work, and a refresh lands where you were.
 *
 * Put the same state inside the grid and all four of those quietly stop being
 * true, which is how V1 ended up with 55 tables nobody could link to.
 *
 * Parsing is total: anything unrecognised falls back to the default rather
 * than throwing. A hand-edited URL should show the first page of invoices, not
 * an error screen.
 */

const STATUS_VALUES = new Set<string>(Object.values(InvoiceStatus))
const SORT_VALUES = new Set<string>(Object.values(InvoiceSortField))

const MAX_PAGE_SIZE = 100

/**
 * A param under either spelling.
 *
 * The short names are what a person writes by hand: `?q=api&type=metered`
 * beats `?search=api&types=%5B%22metered%22%5D`. The long names are what
 * TanStack writes, because it serialises the query object as it stands.
 *
 * Reading both is what makes the round trip work. Reading only the short ones
 * meant every filter and sort reverted the instant it was applied: navigate
 * wrote `types`, the parser looked for `type`, found nothing, and returned the
 * default: with no error anywhere.
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

export function parseInvoiceSearch(raw: Record<string, unknown>): InvoiceQuery {
  const statusesRaw = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(statusesRaw) ? statusesRaw : String(statusesRaw ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is InvoiceStatus => STATUS_VALUES.has(s))

  const sortBy = String(param(raw, 'sort', 'sortBy') ?? '')
  const direction = String(param(raw, 'dir', 'sortDirection') ?? '')

  return {
    page: positiveInt(raw['page'], DEFAULT_INVOICE_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_INVOICE_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    sortBy: SORT_VALUES.has(sortBy) ? (sortBy as InvoiceSortField) : DEFAULT_INVOICE_QUERY.sortBy,
    sortDirection: direction === 'asc' ? 'asc' : 'desc',
    // De-duplicated so `?status=paid&status=paid` cannot produce a filter that
    // looks selected twice in the UI.
    statuses: [...new Set(statuses)],
    search: String(param(raw, 'q', 'search') ?? ''),
    // The entity filter is kept here; the list sends it only while entities are enabled.
    filters: runnableFilters(decodeListFilters(raw['filters']), [
      ...INVOICE_FILTERS,
      BILLING_ENTITY_FILTER,
    ]),
  }
}
