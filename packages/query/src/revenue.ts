import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type RevenueDashboardWire,
  call,
  fetchRevenueDashboard,
} from '@fp/api'
import { compareMoney, money, type Money } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/** One currency's invoiced revenue for the window, as the server summed it. */
export interface RevenueSummary {
  currency: string
  total: Money
  usage: Money
  fixed: Money
}

/** One customer's invoiced revenue in one currency. */
export interface RevenueCustomer {
  customerId: string
  name: string
  total: Money
  usage: Money
  fixed: Money
}

export interface RevenueOverview {
  /**
   * Per currency, the one billed to the most customers first. Amounts in
   * different currencies are never added together.
   */
  summaries: RevenueSummary[]
  /** Every customer that was billed, highest first within each currency. */
  customers: RevenueCustomer[]
}

const amountOr = (value: string | undefined) => (value && value.trim() ? value.trim() : '0')

/** Wire to domain. Rows with a malformed amount are dropped rather than shown as $NaN. */
export function toRevenueOverview(wire: RevenueDashboardWire): RevenueOverview {
  const customers: RevenueCustomer[] = []
  const billedTo = new Map<string, number>()
  for (const item of wire.items ?? []) {
    const currency = (item.currency ?? '').trim().toUpperCase()
    if (!currency) continue
    try {
      customers.push({
        customerId: item.customer_id ?? '',
        name: item.customer_name || item.external_customer_id || item.customer_id || 'Unknown',
        total: money(amountOr(item.total_revenue), currency),
        usage: money(amountOr(item.total_usage_revenue), currency),
        fixed: money(amountOr(item.total_fixed_revenue), currency),
      })
      billedTo.set(currency, (billedTo.get(currency) ?? 0) + 1)
    } catch {
      // A malformed decimal from the server is skipped, not rendered.
    }
  }

  const summaries: RevenueSummary[] = []
  for (const [code, summary] of Object.entries(wire.summaries ?? {})) {
    const currency = code.trim().toUpperCase()
    if (!currency) continue
    try {
      summaries.push({
        currency,
        total: money(amountOr(summary.total_revenue), currency),
        usage: money(amountOr(summary.total_usage_revenue), currency),
        fixed: money(amountOr(summary.total_fixed_revenue), currency),
      })
    } catch {
      // As above.
    }
  }
  summaries.sort(
    (a, b) =>
      (billedTo.get(b.currency) ?? 0) - (billedTo.get(a.currency) ?? 0) ||
      a.currency.localeCompare(b.currency),
  )
  customers.sort((a, b) =>
    a.total.currency === b.total.currency
      ? compareMoney(b.total, a.total)
      : a.total.currency.localeCompare(b.total.currency),
  )
  return { summaries, customers }
}

/**
 * Invoiced revenue for a window — `POST /dashboard/revenue-dashboard`, reached
 * with `fetch` because the SDK has no binding for it. See `@fp/api/revenue`.
 */
export function useRevenueOverview(
  environmentId: string | null,
  window: { start: Date; end: Date },
): UseQueryResult<RevenueOverview> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.revenue.overview({
      environmentId,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    }),
    queryFn: async () => {
      const token = await auth.getToken()
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to see revenue.')
      return toRevenueOverview(
        await fetchRevenueDashboard(serverURL, token, environmentId as string, window),
      )
    },
    enabled: Boolean(environmentId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

/** One day of net revenue in one currency. */
export interface RevenueDay {
  /** `YYYY-MM-DD`, UTC. */
  day: string
  currency: string
  /** Net of discounts. A chart value, never shown as money. */
  amount: number
}

/**
 * Net revenue per day — `POST /analytics/revenue` at day granularity, grouped
 * by currency so no two currencies share a point.
 *
 * Needs the tenant's revenue analytics setting; where it is off the request
 * fails and the caller shows the headline without a series.
 */
export function useRevenueSeries(window: { start: Date; end: Date }): UseQueryResult<RevenueDay[]> {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.revenue.series({
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.analytics.getRevenueAnalytics(
            {
              startTime: window.start,
              endTime: window.end,
              granularity: 'day',
              groupBy: ['currency'],
            },
            options,
          ),
        signal,
      )
      return (response.rows ?? []).flatMap((row) => {
        const currency = (row.group?.['currency'] ?? '').trim().toUpperCase()
        if (!row.day || !currency) return []
        return [{ day: row.day.slice(0, 10), currency, amount: row.netAmount ?? 0 }]
      })
    },
    staleTime: 60_000,
    retry: false,
    placeholderData: (previous) => previous,
  })
}
