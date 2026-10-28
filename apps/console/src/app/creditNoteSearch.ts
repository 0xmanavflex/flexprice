import {
  BILLING_ENTITY_FILTER,
  type CreditNoteQuery,
  CreditNoteStatus,
  DEFAULT_CREDIT_NOTE_QUERY,
  decodeListFilters,
  runnableFilters,
} from '@fp/domain'

/**
 * The credit memo query, as URL search params. Total, like every list codec
 * here: a hand-edited URL shows the first page rather than an error.
 */
const STATUSES = new Set<string>(Object.values(CreditNoteStatus))
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

export function parseCreditNoteSearch(raw: Record<string, unknown>): CreditNoteQuery {
  const rawStatuses = param(raw, 'status', 'statuses')
  const statuses = (Array.isArray(rawStatuses) ? rawStatuses : String(rawStatuses ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is CreditNoteStatus => STATUSES.has(s))

  return {
    page: positiveInt(raw['page'], DEFAULT_CREDIT_NOTE_QUERY.page),
    pageSize: positiveInt(
      param(raw, 'size', 'pageSize'),
      DEFAULT_CREDIT_NOTE_QUERY.pageSize,
      MAX_PAGE_SIZE,
    ),
    search: String(param(raw, 'q', 'search') ?? '').trim(),
    statuses: [...new Set(statuses)],
    // Kept here; the list sends it only while entities are enabled.
    filters: runnableFilters(decodeListFilters(raw['filters']), [BILLING_ENTITY_FILTER]),
  }
}
