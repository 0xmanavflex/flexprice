import { addMonths } from '@fp/domain'

/** A rollforward page as URL search params: the ended month, the customer search and the page. */
export interface RollforwardSearch {
  /** `YYYY-MM`; an ended month. */
  period: string
  search: string
  page: number
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
/** How many ended months the period picker offers. */
const MONTHS_BACK = 36

/** The last ended month, e.g. on Oct 27 2026 → 2026-09. */
export const lastEndedPeriod = () => addMonths(new Date().toISOString().slice(0, 7), -1)

export const DEFAULT_ROLLFORWARD_SEARCH: RollforwardSearch = {
  period: lastEndedPeriod(),
  search: '',
  page: 1,
}

/** Ended months, newest first. */
export function rollforwardPeriods(): string[] {
  const last = lastEndedPeriod()
  return Array.from({ length: MONTHS_BACK }, (_, index) => addMonths(last, -index))
}

/** A month that has not ended, or a malformed one, falls back to the last ended month. */
export function parseRollforwardSearch(raw: Record<string, unknown>): RollforwardSearch {
  const last = lastEndedPeriod()
  const period =
    typeof raw['period'] === 'string' && MONTH.test(raw['period']) && raw['period'] <= last
      ? raw['period']
      : last
  const page = Number.parseInt(String(raw['page'] ?? ''), 10)
  return {
    period,
    search: typeof raw['search'] === 'string' ? raw['search'] : '',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}
