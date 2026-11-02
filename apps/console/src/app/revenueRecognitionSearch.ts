import { addMonths } from '@fp/domain'

/**
 * Revenue › Revenue recognition as URL search params: the month range, the page
 * and Details. A hand-edited URL falls back to this year rather than failing.
 */
export interface RevenueRecognitionSearch {
  /** `YYYY-MM`, inclusive. */
  from: string
  to: string
  page: number
  pageSize: number
  details: boolean
  /** Customer name, matched by the customers search. */
  search: string
}

/** The report's limit. */
const MAX_MONTHS = 36
const MAX_PAGE_SIZE = 100
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const thisYear = new Date().getUTCFullYear()

export const DEFAULT_REVENUE_RECOGNITION_SEARCH: RevenueRecognitionSearch = {
  from: `${thisYear}-01`,
  to: `${thisYear}-12`,
  page: 1,
  pageSize: 50,
  details: false,
  search: '',
}

/** The months the range pickers offer: three years back to the end of next year. */
export function revenueRecognitionMonths(): string[] {
  const first = `${thisYear - 3}-01`
  return Array.from({ length: 60 }, (_, index) => addMonths(first, index))
}

const positiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(Math.trunc(parsed), max) : fallback
}

/** Swaps a backwards range and trims one past 36 months from its end, e.g. 2024-01 → 2026-12 keeps 2024-01 → 2026-12. */
export function parseRevenueRecognitionSearch(
  raw: Record<string, unknown>,
): RevenueRecognitionSearch {
  const month = (value: unknown, fallback: string) =>
    typeof value === 'string' && MONTH.test(value) ? value : fallback
  let from = month(raw['from'], DEFAULT_REVENUE_RECOGNITION_SEARCH.from)
  let to = month(raw['to'], DEFAULT_REVENUE_RECOGNITION_SEARCH.to)
  if (to < from) [from, to] = [to, from]
  const last = addMonths(from, MAX_MONTHS - 1)
  return {
    from,
    to: to > last ? last : to,
    page: positiveInt(raw['page'], 1, Number.MAX_SAFE_INTEGER),
    pageSize: positiveInt(
      raw['pageSize'],
      DEFAULT_REVENUE_RECOGNITION_SEARCH.pageSize,
      MAX_PAGE_SIZE,
    ),
    details: raw['details'] === true || raw['details'] === 'true',
    search: typeof raw['search'] === 'string' ? raw['search'].trim() : '',
  }
}
