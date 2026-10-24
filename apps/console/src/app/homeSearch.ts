/**
 * Home's filters, as URL search params: the range, the granularity, a custom
 * date span, and which metric tab is open. The page remounts on every visit,
 * so without this a chosen filter snaps back to the default.
 */
export interface HomeSearch {
  range: string
  grain: string
  from: string
  to: string
  metric: string
}

export const DEFAULT_HOME_SEARCH: HomeSearch = {
  range: '7d',
  grain: 'daily',
  from: '',
  to: '',
  metric: 'revenue',
}

/**
 * DashboardHome's `CUSTOM_RANGE_ID`, written out so this parser stays free of
 * the UI package (it runs in the router and in unit tests).
 */
export const HOME_CUSTOM_RANGE = 'custom'

const RANGES = new Set(['7d', '14d', '30d', '90d', '180d', '365d', HOME_CUSTOM_RANGE])
const GRAINS = new Set(['hourly', 'daily', 'weekly'])
const METRICS = new Set(['revenue', 'customers', 'events'])
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function parseHomeSearch(search: Record<string, unknown>): HomeSearch {
  const range = RANGES.has(String(search['range']))
    ? String(search['range'])
    : DEFAULT_HOME_SEARCH.range
  const grain = GRAINS.has(String(search['grain']))
    ? String(search['grain'])
    : DEFAULT_HOME_SEARCH.grain
  const from = DAY.test(String(search['from'])) ? String(search['from']) : ''
  const to = DAY.test(String(search['to'])) ? String(search['to']) : ''
  const metric = METRICS.has(String(search['metric']))
    ? String(search['metric'])
    : DEFAULT_HOME_SEARCH.metric
  return { range, grain, from, to, metric }
}
