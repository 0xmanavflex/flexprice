import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useInvoices, useUsageAnalytics, UsageWindowSize } from '@fp/query'
import type { UsageAnalytics } from '@fp/query'
import { DEFAULT_INVOICE_QUERY, InvoiceStatus } from '@fp/domain'
import type { Invoice } from '@fp/domain'
import { RevenueDashboard } from '@fp/ui/pages'
import type { MetricTab, RevenueDashboardProps } from '@fp/ui/pages'

/**
 * Revenue — wired to what the API can actually answer, and explicit about the
 * rest.
 *
 * `RevenueDashboard` is presentational: it renders whatever panel status it is
 * handed. Choosing that status is this file's whole job, and the rule it
 * follows is `HomePage`'s rule — a number reaches the screen only if a request
 * returned it.
 *
 * What is real here:
 *
 *   - **Metered volume over time** and **the mix by feature**, from
 *     `useUsageAnalytics` over `POST /events/analytics`. Fetched twice — this
 *     window and the one before it — so every change on the tab strip is two
 *     real measurements compared rather than a figure chosen to look like
 *     growth.
 *   - **The window's priced subtotal**, straight off the same response. It is
 *     the only money figure on the page, and it is the server's own number.
 *   - **Collections**, from `useInvoices`, bucketed by the status the domain
 *     derives (paid / open / overdue — neither of the last two is a stored
 *     field, which is why `deriveInvoiceStatus` exists).
 *
 * What is not, and is shown as absent with the reason:
 *
 *   - **Revenue per period.** The analytics response prices the window as a
 *     whole. Its per-bucket points carry event counts and metered quantities;
 *     there is no per-bucket money anywhere in the payload, and spreading the
 *     one subtotal across thirty days would invent twenty-nine numbers.
 *   - **Gross margin.** Nothing aggregates cost against revenue, and `Money`
 *     has no `add` (`@fp/domain/money`), so the page cannot do it either.
 *
 * Note what is deliberately *not* read. `useTenantBillingUsage` looks like a
 * revenue source and is the opposite one: it is Flexprice's bill to this
 * tenant, not this tenant's revenue from its own customers. `usePayments`
 * filters client-side on a single page while reporting the server's unfiltered
 * total, so counting collections through it would be a sample dressed as a
 * census; the invoice list carries the same facts and sorts by issue date.
 */

const DAY_MS = 86_400_000

/**
 * The window the whole page is measured over.
 *
 * Thirty days rather than the overview's seven, and not only for variety: the
 * overview answers "what is happening", which is a question about this week,
 * while a revenue report answers "what did we bill", which is a question about
 * the billing cycle. It also keeps the two surfaces from quoting the same
 * number at each other as if they were two findings.
 */
const RANGE_DAYS = 30
const RANGE_LABEL = 'last 30 days'

/** Midnight UTC `daysAgo` days back — the boundary every window is cut on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const dayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/**
 * Percentage change between two windows, or `null` when there is nothing to
 * compare against.
 *
 * Growth from zero is not a percentage — it is "the first one" — and printing
 * `+100%` for it is the confident nonsense this page exists to avoid.
 */
function change(current: number, prior: number): number | null {
  if (prior <= 0) return null
  return ((current - prior) / prior) * 100
}

interface Window {
  start: Date
  end: Date
}

/**
 * The margin panel's sentence. Stated here because this layer knows the API.
 *
 * Corrected: the previous wording claimed "no endpoint returns the margin",
 * and that is not true. `POST /costs/analytics`
 * (`client.costs.getDetailedCostAnalytics`) returns `total_revenue`,
 * `total_cost`, `margin` and `margin_percent` outright. What is true is that
 * nothing in this repo calls it — there is no hook, and it is not in the mock
 * handlers either — so the figure is unwired rather than unavailable. Saying
 * "the API cannot" when the truth is "we have not" sends the next person to
 * the wrong team.
 */
const MARGIN_UNAVAILABLE =
  'Gross margin is not wired up yet. The cost analytics endpoint does return revenue, cost and margin together, but no hook in this console calls it, so there is no figure to show rather than no figure to be had.'

/**
 * Why the per-customer table cannot be drawn, column by column.
 *
 * Each `blocker` names the specific capability, so the screen doubles as the
 * spec for the backend work. Findings from a sweep of `@flexprice/sdk`
 * 2.1.30: there is no `POST /analytics/revenue` at all; `POST
 * /events/analytics` cannot group by customer (`group_by` takes only
 * `source`, `feature_id` and `properties.*`); `POST /costs/analytics` answers
 * for the tenant or for a single `external_customer_id`; and the one
 * per-customer revenue figure that exists — `total_revenue_amount` from `GET
 * /customers/{id}/invoices/summary` — is a lifetime total, split by currency,
 * one HTTP call per customer, and unwired.
 */
const REVENUE_BY_CUSTOMER_UNAVAILABLE =
  'No endpoint returns revenue grouped by customer. The figures below could only be assembled one request per customer, or by summing invoices in the browser — which this console does not do, because a total it recomputes will eventually disagree with the invoice the customer was actually charged.'

const REVENUE_BY_CUSTOMER_GAPS = [
  {
    column: 'Plan',
    blocker:
      'A customer record carries no plan; a plan belongs to their contracts. Needs a joined list view, or one contracts request per customer.',
  },
  {
    column: 'Net revenue',
    blocker:
      'Available per customer only as a lifetime total, from GET /customers/{id}/invoices/summary — one call each, not windowed to the range above, and split per currency.',
  },
  {
    column: 'Contract',
    blocker:
      'No endpoint splits recognised revenue into fixed and usage components. The invoice summary splits only what is still unpaid.',
  },
  {
    column: 'Usage',
    blocker:
      'POST /events/analytics prices a window as a whole and cannot group by customer, so usage revenue per customer has no source.',
  },
  {
    column: 'Cost',
    blocker:
      'POST /costs/analytics returns cost per customer, but one external_customer_id per request, and its per-meter items would have to be summed to get a row total.',
  },
  {
    column: 'Margin %',
    blocker:
      'Returned by POST /costs/analytics for the tenant or for a single customer. Needs the same per-customer fan-out as Cost, plus a hook — there is none today.',
  },
]

export function RevenuePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('usage')

  /*
   * Both windows come from one pass, so they are exactly adjacent and the same
   * width. Two independent `Date.now()` calls would leave a sliver of time in
   * neither — and, memoised on nothing else, a fresh `Date` every render would
   * change the query key every render and refetch forever.
   */
  const windows = useMemo(() => {
    const end = new Date()
    const start = dayStart(RANGE_DAYS)
    return {
      current: { start, end },
      prior: { start: new Date(start.getTime() - RANGE_DAYS * DAY_MS), end: start },
    }
  }, [])

  const analytics = useUsageAnalytics({
    window: windows.current,
    windowSize: UsageWindowSize.Day,
  })
  const priorAnalytics = useUsageAnalytics({
    window: windows.prior,
    windowSize: UsageWindowSize.Day,
  })

  /*
   * A page large enough that every invoice inside both windows is on it. The
   * list has no date filter — `toInvoiceFilter` sends limit, offset, sort and
   * status and nothing else — so the window is cut here, over rows the server
   * sorted newest-first. That ordering is what makes the count exact rather
   * than a sample: once the rows fall out of the window, the rest are older
   * still.
   */
  const invoices = useInvoices({
    ...DEFAULT_INVOICE_QUERY,
    pageSize: 200,
    sortBy: 'issuedAt',
    sortDirection: 'desc',
  })

  const chart = useMemo<RevenueDashboardProps['chart']>(
    () => ({
      ...toChartPanel(
        analytics.data,
        priorAnalytics.data,
        invoices.data?.invoices ?? [],
        windows,
        analytics.isPending || invoices.isPending,
        analytics.isError,
      ),
      activeTab,
      onTabChange: setActiveTab,
    }),
    [
      analytics.data,
      analytics.isPending,
      analytics.isError,
      priorAnalytics.data,
      invoices.data,
      invoices.isPending,
      windows,
      activeTab,
    ],
  )

  const mix = useMemo<RevenueDashboardProps['mix']>(
    () => toMixPanel(analytics.data, analytics.isPending, analytics.isError),
    [analytics.data, analytics.isPending, analytics.isError],
  )

  const collections = useMemo<RevenueDashboardProps['collections']>(
    () =>
      toCollectionsPanel(
        invoices.data?.invoices ?? [],
        windows.current,
        invoices.isPending,
        invoices.isError,
      ),
    [invoices.data, invoices.isPending, invoices.isError, windows],
  )

  return (
    <RevenueDashboard
      rangeLabel={RANGE_LABEL}
      chart={chart}
      meteredRevenue={analytics.data?.revenue ?? null}
      mix={mix}
      /*
       * Always unavailable, and it is not a stub: there is no margin
       * anywhere in `@fp/query`, `@fp/api` or the SDK, and the one thing
       * that could stand in for it — subtracting cost-sheet totals from
       * revenue — is money arithmetic in a browser.
       */
      margin={{ status: 'unavailable', percent: null, reason: MARGIN_UNAVAILABLE }}
      collections={collections}
      byCustomer={{
        status: 'unavailable',
        reason: REVENUE_BY_CUSTOMER_UNAVAILABLE,
        columns: REVENUE_BY_CUSTOMER_GAPS,
      }}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
    />
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

/** Invoices issued inside a window. A draft has no issue date and is not one. */
function issuedIn(rows: Invoice[], window: Window): Invoice[] {
  return rows.filter(
    (row) => row.issuedAt !== null && row.issuedAt >= window.start && row.issuedAt < window.end,
  )
}

/**
 * The tab strip and its three series.
 *
 * Every tab's headline is the total of the series plotted beneath it, and every
 * change is the same metric measured over the window before this one. None of
 * the three is money, and that is the finding rather than an omission: see the
 * file header.
 */
function toChartPanel(
  data: UsageAnalytics | undefined,
  prior: UsageAnalytics | undefined,
  invoiceRows: Invoice[],
  windows: { current: Window; prior: Window },
  isPending: boolean,
  isError: boolean,
): Omit<RevenueDashboardProps['chart'], 'activeTab' | 'onTabChange'> {
  if (isError) return { status: 'unavailable', tabs: [] }
  if (isPending || data === undefined) return { status: 'loading', tabs: [] }
  if (data.points.length === 0) return { status: 'empty', tabs: [] }

  const usage = data.points.reduce((sum, point) => sum + point.usage, 0)
  const priorUsage = prior?.points.reduce((sum, point) => sum + point.usage, 0) ?? 0

  // One bucket per day of the window, oldest first, so a quiet day is a gap in
  // the line rather than a day that silently leaves the axis.
  const invoiceBuckets: { label: string; value: number }[] = []
  const issued = issuedIn(invoiceRows, windows.current)
  for (let offset = RANGE_DAYS - 1; offset >= 0; offset -= 1) {
    const start = dayStart(offset)
    const end = new Date(start.getTime() + DAY_MS)
    invoiceBuckets.push({
      label: dayLabel.format(start),
      value: issued.filter(
        (row) => row.issuedAt !== null && row.issuedAt >= start && row.issuedAt < end,
      ).length,
    })
  }

  const tabs: MetricTab[] = [
    {
      id: 'usage',
      label: 'Metered usage',
      value: compact.format(usage),
      changePercent: change(usage, priorUsage) ?? undefined,
      points: data.points.map((point) => ({
        label: dayLabel.format(point.timestamp),
        value: point.usage,
      })),
      format: (value) => compact.format(value),
    },
    {
      id: 'events',
      label: 'Events ingested',
      value: compact.format(data.eventCount),
      changePercent: change(data.eventCount, prior?.eventCount ?? 0) ?? undefined,
      points: data.points.map((point) => ({
        label: dayLabel.format(point.timestamp),
        value: point.eventCount,
      })),
      format: (value) => compact.format(value),
    },
    {
      id: 'invoices',
      label: 'Invoices issued',
      value: whole.format(issued.length),
      changePercent:
        change(issued.length, issuedIn(invoiceRows, windows.prior).length) ?? undefined,
      points: invoiceBuckets,
      format: (value) => whole.format(value),
    },
  ]

  return { status: 'ready', tabs }
}

/**
 * The mix, sliced by event count.
 *
 * Capped at four slices, and the cap is honest about itself: past four, the
 * tail is folded into one "Other features" slice so the parts still sum to the
 * centre figure. A donut whose slices do not add up to its own total is the
 * fixture bug this page was rebuilt to stop shipping.
 *
 * Three rather than five because the donut's footer *is* its legend — the only
 * accessible way to say which arc is which — and it is a row of equal columns.
 * Three is what every `HalfDonut` story feeds it and what its columns are cut
 * for; at a phone's width, four feature names run into each other. A legend
 * that cannot be read is worse than a tail that has been folded into "other".
 */
function toMixPanel(
  data: UsageAnalytics | undefined,
  isPending: boolean,
  isError: boolean,
): RevenueDashboardProps['mix'] {
  if (isError) return { status: 'unavailable', slices: [], total: 0 }
  if (isPending || data === undefined) return { status: 'loading', slices: [], total: 0 }

  const ranked = [...data.features]
    .filter((feature) => feature.eventCount > 0)
    .sort((a, b) => b.eventCount - a.eventCount)
  if (ranked.length === 0) return { status: 'empty', slices: [], total: 0 }

  const named = ranked.length <= 3 ? ranked : ranked.slice(0, 2)
  const slices = named.map((feature) => ({
    id: feature.featureId,
    label: feature.name,
    value: feature.eventCount,
  }))

  const rest = ranked.slice(named.length).reduce((sum, feature) => sum + feature.eventCount, 0)
  if (rest > 0) slices.push({ id: 'other', label: 'Other features', value: rest })

  return {
    status: 'ready',
    slices,
    // The sum of the slices, not `data.eventCount`: features with no events in
    // the window are dropped above, and a centre figure larger than its own
    // ring is exactly the disagreement this panel must not show.
    total: slices.reduce((sum, slice) => sum + slice.value, 0),
  }
}

function toCollectionsPanel(
  rows: Invoice[],
  window: Window,
  isPending: boolean,
  isError: boolean,
): RevenueDashboardProps['collections'] {
  const blank = { paid: 0, open: 0, overdue: 0 }
  if (isError) return { status: 'unavailable', ...blank }
  if (isPending) return { status: 'loading', ...blank }

  const issued = issuedIn(rows, window)
  if (issued.length === 0) return { status: 'empty', ...blank }

  const count = (status: string) => issued.filter((row) => row.status === status).length

  return {
    status: 'ready',
    paid: count(InvoiceStatus.Paid),
    open: count(InvoiceStatus.Open),
    overdue: count(InvoiceStatus.Overdue),
  }
}
