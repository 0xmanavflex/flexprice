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

/** The most days one `POST /analytics/revenue` covers; past it the API answers 400. */
export const REVENUE_ANALYTICS_MAX_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000
const floorDayUTC = (value: Date) => Math.floor(value.getTime() / DAY_MS) * DAY_MS

/**
 * A window cut into requests the revenue analytics API accepts.
 *
 * The API counts whole UTC days, `floor(start)` to `floor(end)` inclusive, and
 * refuses a request whose `end - start` exceeds 90 days ("Narrow the time
 * range or run multiple requests"). Each piece is day-aligned so no day is
 * asked for twice, and none spans more than 90 days.
 */
export function revenueAnalyticsWindows(
  window: { start: Date; end: Date },
  maxDays = REVENUE_ANALYTICS_MAX_DAYS,
): { start: Date; end: Date }[] {
  const pieces: { start: Date; end: Date }[] = []
  const lastDay = floorDayUTC(window.end)
  let start = window.start
  // `maxDays - 1` days after the first: that day is still the piece's own.
  for (;;) {
    const firstDay = floorDayUTC(start)
    const pieceLastDay = firstDay + (maxDays - 1) * DAY_MS
    if (lastDay <= pieceLastDay) {
      pieces.push({ start, end: window.end })
      return pieces
    }
    pieces.push({ start, end: new Date(pieceLastDay) })
    start = new Date(pieceLastDay + DAY_MS)
  }
}

/**
 * Net revenue per day — `POST /analytics/revenue` at day granularity, grouped
 * by currency so no two currencies share a point.
 *
 * A window longer than the API's 90 days is asked for in pieces, in parallel,
 * and the days joined (`revenueAnalyticsWindows`).
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
      const responses = await Promise.all(
        revenueAnalyticsWindows(window).map((piece) =>
          call(
            (options) =>
              client.analytics.getRevenueAnalytics(
                {
                  startTime: piece.start,
                  endTime: piece.end,
                  granularity: 'day',
                  groupBy: ['currency'],
                },
                options,
              ),
            signal,
          ),
        ),
      )
      return responses
        .flatMap((response) => response.rows ?? [])
        .flatMap((row) => {
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

/* ---- Invoiced revenue ------------------------------------------------------ */

/** One finalized invoice, as the revenue chart reads it. */
export interface InvoicedRow {
  customerId: string
  customerName: string
  /** The exact decimal the API sent. */
  amount: string
  currency: string
  createdAt: Date
}

/** One currency's invoiced revenue: the exact total, its rows and its customers. */
export interface InvoicedCurrency {
  currency: string
  total: Money
  rows: InvoicedRow[]
  /** Highest first, exact. */
  customers: RevenueCustomer[]
}

export interface InvoicedRevenue {
  /** The currency invoiced to the most customers first; others are never added in. */
  currencies: InvoicedCurrency[]
}

/**
 * Adds decimal strings exactly — no float ever holds an amount.
 *
 * `Money` deliberately has no `add`: an invoice's own total is the backend's
 * answer. This is not that. It adds whole invoice totals the backend already
 * computed, so the headline is exactly the sum of the points plotted under it.
 */
export function sumDecimals(amounts: readonly string[]): string {
  const scale = Math.max(0, ...amounts.map((a) => (a.split('.')[1] ?? '').length))
  let sum = 0n
  for (const amount of amounts) {
    const negative = amount.startsWith('-')
    const [whole = '0', fraction = ''] = amount.replace('-', '').split('.')
    const units = BigInt(whole + fraction.padEnd(scale, '0'))
    sum += negative ? -units : units
  }
  const negative = sum < 0n
  const digits = (negative ? -sum : sum).toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
}

/** Groups finalized invoices by currency and customer, with exact totals. */
export function toInvoicedRevenue(rows: readonly InvoicedRow[]): InvoicedRevenue {
  const byCurrency = new Map<string, InvoicedRow[]>()
  for (const row of rows) {
    const list = byCurrency.get(row.currency) ?? []
    list.push(row)
    byCurrency.set(row.currency, list)
  }
  const currencies = [...byCurrency.entries()].map(([currency, list]): InvoicedCurrency => {
    const byCustomer = new Map<string, InvoicedRow[]>()
    for (const row of list) {
      const own = byCustomer.get(row.customerId) ?? []
      own.push(row)
      byCustomer.set(row.customerId, own)
    }
    const customers = [...byCustomer.entries()]
      .map(([customerId, own]) => ({
        customerId,
        name: own[0]?.customerName ?? customerId,
        total: money(sumDecimals(own.map((row) => row.amount)), currency),
        usage: money('0', currency),
        fixed: money('0', currency),
      }))
      .sort((a, b) => compareMoney(b.total, a.total))
    return {
      currency,
      total: money(sumDecimals(list.map((row) => row.amount)), currency),
      rows: list,
      customers,
    }
  })
  currencies.sort(
    (a, b) => b.customers.length - a.customers.length || a.currency.localeCompare(b.currency),
  )
  return { currencies }
}

/** Invoices read per page, and the most pages a window may take (10 000 invoices). */
const INVOICE_PAGE = 1000
const INVOICE_PAGES = 10

/**
 * Invoiced revenue for a window — every FINALIZED invoice created in it, from
 * `POST /invoices/search` (`invoice_status` plus `created_at` after/before),
 * paged until the total is read. Works for every tenant; nothing to enable.
 */
export function useInvoicedRevenue(window: {
  start: Date
  end: Date
}): UseQueryResult<InvoicedRevenue> {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.revenue.series({
      source: 'invoices',
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    }),
    queryFn: async ({ signal }) => {
      const rows: InvoicedRow[] = []
      for (let page = 0; page < INVOICE_PAGES; page += 1) {
        const response = await call(
          (options) =>
            client.invoices.queryInvoice(
              {
                limit: INVOICE_PAGE,
                offset: page * INVOICE_PAGE,
                invoiceStatus: ['FINALIZED'],
                skipLineItems: true,
                sort: [{ field: 'created_at', direction: 'asc' }],
                filters: [
                  {
                    field: 'created_at',
                    operator: 'after',
                    dataType: 'date',
                    value: { date: new Date(window.start.getTime() - 1).toISOString() },
                  },
                  {
                    field: 'created_at',
                    operator: 'before',
                    dataType: 'date',
                    value: { date: window.end.toISOString() },
                  },
                ],
              } as never,
              options,
            ),
          signal,
        )
        const items = (response.items ?? []) as Array<{
          customerId?: string
          customer?: { name?: string; email?: string }
          total?: string
          currency?: string
          createdAt?: Date
        }>
        for (const item of items) {
          const currency = (item.currency ?? '').trim().toUpperCase()
          if (!currency || !item.createdAt || !/^-?\d+(\.\d+)?$/.test(item.total ?? '')) continue
          rows.push({
            customerId: item.customerId ?? '',
            customerName:
              item.customer?.name || item.customer?.email || item.customerId || 'Unknown',
            amount: item.total as string,
            currency,
            createdAt: new Date(item.createdAt),
          })
        }
        const total = response.pagination?.total ?? 0
        if (items.length < INVOICE_PAGE || (page + 1) * INVOICE_PAGE >= total) break
      }
      return toInvoicedRevenue(rows)
    },
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}
