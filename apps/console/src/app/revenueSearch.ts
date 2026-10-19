import type { RevenueView } from '@fp/ui/pages'
import { RANGE_OPTIONS, type RangeId } from '@/pages/revenue/revenueReport'

/**
 * The Revenue report's state, as URL search params: the tab, the range, the
 * comparison and the currency. Kept apart from the lazy page so the router can
 * validate the URL without loading it.
 */
export interface RevenueSearch {
  view: RevenueView
  range: RangeId
  compare: string
  currency: string
}

export const DEFAULT_REVENUE_SEARCH: RevenueSearch = {
  view: 'overview',
  range: '90d',
  compare: 'none',
  currency: '',
}

const VIEWS: RevenueView[] = [
  'overview',
  'revenue',
  'customers',
  'receivables',
  'payments',
  'usage',
]

export function parseRevenueSearch(search: Record<string, unknown>): RevenueSearch {
  const view = VIEWS.includes(search['view'] as RevenueView)
    ? (search['view'] as RevenueView)
    : 'overview'
  const range = RANGE_OPTIONS.some((option) => option.id === search['range'])
    ? (search['range'] as RangeId)
    : '90d'
  const compare = search['compare'] === 'previous' ? 'previous' : 'none'
  const currency = typeof search['currency'] === 'string' ? search['currency'].toUpperCase() : ''
  return { view, range, compare, currency }
}
