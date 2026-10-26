import type { RevenueView } from '@fp/ui/pages'
import {
  GRAIN_OPTIONS,
  RANGE_OPTIONS,
  type GrainChoice,
  type RangeId,
} from '@/pages/revenue/revenueReport'

/**
 * The Revenue report's state, as URL search params: the tab, the range, the
 * comparison and the currency. Kept apart from the lazy page so the router can
 * validate the URL without loading it.
 */
export interface RevenueSearch {
  view: RevenueView
  range: RangeId
  grain: GrainChoice
  compare: string
  currency: string
}

export const DEFAULT_REVENUE_SEARCH: RevenueSearch = {
  view: 'overview',
  range: '12m',
  grain: 'auto',
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
    : '12m'
  const grain = GRAIN_OPTIONS.some((option) => option.id === search['grain'])
    ? (search['grain'] as GrainChoice)
    : 'auto'
  const compare = search['compare'] === 'previous' ? 'previous' : 'none'
  const currency = typeof search['currency'] === 'string' ? search['currency'].toUpperCase() : ''
  return { view, range, grain, compare, currency }
}
