import type { ReactNode } from 'react'
import { CalendarIcon } from 'lucide-react'
import type { Money as MoneyValue } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { SimpleTable } from '@ui/compositions/DetailKit'
import type { SimpleColumn } from '@ui/compositions/DetailKit'
import { Panel } from '@ui/compositions/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ArcGauge } from '../shared/ArcGauge'
import { BlurredEmpty, MetricChart, seriesTone } from '../shared/charts'
import type { MetricTab } from '../shared/charts'
import { HalfDonut } from '../shared/HalfDonut'
import { Money } from '../shared/Money'
import { SplitMeter } from '../shared/SplitMeter'

/**
 * Revenue — built on the shared chart library, and on what the API can answer.
 *
 * This surface replaces one that carried its own numbers: a KPI strip reading
 * "$482,900.00 net revenue", a six-month contract/usage mix, five named
 * customers with their spend, and a gross margin of 68%. Not one of those
 * figures came from anywhere. They were a design, and a design's figures are a
 * design — which is the whole reason this dashboard was rebuilt rather than
 * wired: there was nothing behind it to wire.
 *
 * So the rule is `DashboardHome`'s rule, applied to a harder page: **every
 * number here is read from the API or absent.** On Revenue the rule bites
 * hardest, because the two things the page is named after are the two the
 * platform does not return:
 *
 *   - **Revenue per period.** `POST /events/analytics` prices a window *as a
 *     whole* — one `subtotal` for the range you asked about — and its per-bucket
 *     points carry event counts and metered quantities, not money. So there is
 *     no revenue line to draw. The chart plots the volume that *is* bucketed,
 *     and the caption says what that volume was priced at and why the line is
 *     not money. Apportioning the subtotal across the buckets would produce a
 *     beautiful revenue curve that no invoice would agree with.
 *   - **Gross margin.** Margin is revenue minus the cost of serving it. Cost
 *     sheets record the cost side, but nothing in the API aggregates the two,
 *     and `Money` has no `add` by design (`@fp/domain/money`), so the browser
 *     cannot do it either. The panel keeps its place and shows an em-dash with
 *     the reason — the same choice `DashboardHome` makes for processing lag and
 *     request latency, and for the same reason: deleting the panel would make
 *     "we do not measure this" and "this is not a thing" look identical.
 *
 * Presentational, and holding no queries, so its story can exercise the ready,
 * empty and unavailable states as first-class cases rather than as whatever the
 * network happened to do. `RevenuePage` decides which status each panel is in;
 * that decision is the honesty, and it belongs next to the hooks.
 */
export const RevenueDashboardProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/charts',
    'pages/shared/HalfDonut',
    'pages/shared/SplitMeter',
    'pages/shared/ArcGauge',
    'pages/shared/Money',
    'compositions/Section',
    'compositions/DetailKit',
  ],
  note: 'Revenue: metered volume over time, the usage mix by feature, collections by invoice state, and gross margin shown as unavailable. Every figure is API-sourced or explicitly absent.',
})

/* ---- What the page is told ---------------------------------------------- */

/**
 * Why a panel is showing what it is showing.
 *
 * `empty` and `unavailable` are different claims and get different treatments:
 * `empty` means the API answered and there is nothing yet, which deserves an
 * invitation; `unavailable` means the question cannot be asked at all, which
 * deserves an explanation and no invitation.
 *
 * Declared here rather than imported from `DashboardHome` so the two surfaces
 * can be edited independently — they agree on the vocabulary, not on a file.
 */
export type RevenuePanelStatus = 'loading' | 'ready' | 'empty' | 'unavailable'

/** One categorical slice of the mix. The tone is assigned here, not by the page. */
export interface RevenueMixSlice {
  id: string
  label: string
  value: number
}

export interface RevenueDashboardProps {
  /** Words for the window, e.g. "last 30 days". Used in the panels' subtitles. */
  rangeLabel: string

  /**
   * The metric panel: tabs across the top, one line below.
   *
   * Fully controlled from the page, because which metric you are reading is the
   * kind of thing that belongs in the URL.
   */
  chart: {
    status: RevenuePanelStatus
    tabs: MetricTab[]
    activeTab: string
    onTabChange: (id: string) => void
  }

  /**
   * What the analytics API priced this window's metered usage at.
   *
   * `null` when it sent no subtotal. Not zero — "the server did not price this"
   * and "this was worth nothing" are different sentences.
   */
  meteredRevenue: MoneyValue | null

  /** Metered volume by feature. Categorical, so `series-*` tones in fixed order. */
  mix: {
    status: RevenuePanelStatus
    slices: RevenueMixSlice[]
    /** Events across every feature in the window — the centre figure. */
    total: number
  }

  /**
   * Gross margin.
   *
   * `status` is `unavailable` in the console today and `reason` says why. The
   * ready branch exists so the panel is a wiring change rather than a rewrite
   * the day an aggregate lands; nothing in the app can reach it now.
   */
  margin: {
    status: RevenuePanelStatus
    /** Percentage points, 0–100. Only read when `status` is `ready`. */
    percent: number | null
    /** One sentence naming what is missing. Shown when the status is not ready. */
    reason: string
  }

  /** Invoices finalised in the window, by the state the domain derives. */
  collections: {
    status: RevenuePanelStatus
    paid: number
    open: number
    overdue: number
  }

  /** Where a link on the report leads. No-op by default, so it renders in isolation. */
  /**
   * Revenue broken down per customer.
   *
   * `columns` is the table that was asked for, and `status` says whether it
   * can be drawn. Today it cannot, and `RevenuePage` says why — so the shape
   * ships as a list of named gaps rather than as a grid. See
   * {@link RevenueByCustomerPanel}.
   */
  byCustomer: {
    status: RevenuePanelStatus
    /** Prose shown above the gap list. */
    reason: string
    /** One entry per column the table would have, and what it waits on. */
    columns: RevenueByCustomerGap[]
    /** Real rows, when an endpoint supplies them. Formatted by the page. */
    rows?: RevenueByCustomerRow[] | undefined
  }
  onNavigate?: (path: string) => void
}

/**
 * One column of the revenue-by-customer table, and the capability it needs.
 *
 * `blocker` is deliberately a sentence naming an endpoint rather than a
 * vague "not available yet": the point of showing this at all is that a
 * reader — or whoever picks up the backend ticket — can tell from the screen
 * exactly what would have to exist.
 */
/** One drawn row of the revenue-by-customer table; every cell arrives formatted. */
export interface RevenueByCustomerRow {
  id: string
  customer: string
  plan: string
  netRevenue: string
  contract: string
  usage: string
  cost: string
  margin: string
}

export interface RevenueByCustomerGap {
  column: string
  blocker: string
}

/* ---- Formatting --------------------------------------------------------- */

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** The dash a number takes when there is nothing true to put there. */
const NOTHING = '—'

/* ---- Shared parts ------------------------------------------------------- */

/**
 * What a panel says when Flexprice cannot answer the question.
 *
 * Named and explained, never "coming soon" and never a zero. `role="status"` so
 * it is announced rather than merely blank.
 */
function Unavailable({ what, className }: { what: string; className?: string }) {
  return (
    <p role="status" className={cn('text-muted-foreground text-xs', className)}>
      {what}
    </p>
  )
}

/**
 * A panel's figure when the panel has nothing to show.
 *
 * The em-dash is the size the real figure would be (`text-4xl`), so an absent
 * number reads as absent rather than as a layout that collapsed.
 */
function AbsentFigure({ caption }: { caption: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <span aria-hidden className="text-muted-foreground text-4xl leading-none font-medium">
        {NOTHING}
      </span>
      <Unavailable what={caption} className="max-w-[34ch] text-balance" />
    </div>
  )
}

/** A header action on a panel: the reference's outline `sm` button. */
function PanelButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      {children}
    </Button>
  )
}

/* ---- 0. The range -------------------------------------------------------- */

/**
 * The reference's header row. Its "This quarter" and "USD" buttons open menus;
 * here the window and currency are fixed by the page, so the range is shown in
 * the same outline button but is not interactive. A control that opens nothing
 * would be a dead one.
 */
function RangeRow({ rangeLabel }: { rangeLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="pointer-events-none h-8 px-3"
        tabIndex={-1}
        aria-label={`Range: ${rangeLabel}`}
      >
        <CalendarIcon aria-hidden="true" />
        {rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}
      </Button>
    </div>
  )
}

/* ---- 1. The metric panel ------------------------------------------------ */

/**
 * The texture behind the first-run message.
 *
 * `BlurredEmpty` renders its child inert, `aria-hidden` and blurred, so this is
 * a shape rather than a claim — the component's own docstring makes that the
 * condition for feeding it placeholder numbers, and the labels are blank so
 * even the axis asserts nothing.
 */
const PLACEHOLDER_POINTS = [18, 26, 21, 34, 29, 41, 38, 52, 47, 61, 55, 68, 74, 71].map(
  (value) => ({ label: '', value }),
)

/**
 * The caption under the plot: the one money figure on this page, and why it is
 * not the line above it.
 *
 * `<Money>` rather than a formatted string, because the component is where
 * currency presentation lives — and `MetricChart.caption` takes a string, which
 * is why this is rendered beside the chart rather than passed into it.
 */
function MeteredRevenueNote({
  revenue,
  rangeLabel,
}: {
  revenue: MoneyValue | null
  rangeLabel: string
}) {
  return (
    <p className="text-muted-foreground text-xs">
      {revenue === null ? (
        <>
          The analytics API returned no priced subtotal for the {rangeLabel}, so there is no revenue
          figure for this window.
        </>
      ) : (
        <>
          Metered usage in the {rangeLabel} priced at{' '}
          <span className="text-foreground font-medium tabular-nums">
            <Money value={revenue} />
          </span>
          . The API prices the window as a whole and returns no per-period figure, so the line above
          plots volume, not money.
        </>
      )}
    </p>
  )
}

function MetricPanel({
  chart,
  meteredRevenue,
  rangeLabel,
  onGetStarted,
  onSeePlans,
}: {
  chart: RevenueDashboardProps['chart']
  meteredRevenue: MoneyValue | null
  rangeLabel: string
  onGetStarted: () => void
  onSeePlans: () => void
}) {
  if (chart.status !== 'ready') {
    const placeholder: MetricTab[] = [
      { id: 'placeholder', label: 'Metered usage', value: NOTHING, points: PLACEHOLDER_POINTS },
    ]
    const unavailable = chart.status === 'unavailable'
    const loading = chart.status === 'loading'

    return (
      <BlurredEmpty
        title={
          unavailable
            ? 'Usage analytics unavailable'
            : loading
              ? 'Loading revenue'
              : 'No revenue yet'
        }
        description={
          unavailable
            ? 'Usage analytics could not be loaded for this window. Try again in a moment.'
            : loading
              ? 'Fetching usage analytics for this window.'
              : 'Price a plan and send your first usage events — this chart then plots the volume behind every invoice.'
        }
        action={
          chart.status === 'empty' ? { label: 'Create a plan', onClick: onSeePlans } : undefined
        }
        secondaryAction={
          chart.status === 'empty' ? { label: 'Add a feature', onClick: onGetStarted } : undefined
        }
      >
        <MetricChart
          tabs={placeholder}
          activeTab="placeholder"
          onTabChange={() => undefined}
          height={260}
        />
      </BlurredEmpty>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <MetricChart
        tabs={chart.tabs}
        activeTab={chart.activeTab}
        onTabChange={chart.onTabChange}
        height={260}
      />
      <MeteredRevenueNote revenue={meteredRevenue} rangeLabel={rangeLabel} />
    </div>
  )
}

/* ---- 2. Revenue mix ----------------------------------------------------- */

/**
 * Where the metered volume comes from, by feature.
 *
 * Sliced by **event count**, not by metered quantity, and that is a
 * deliberate correction rather than a convenience: one feature is measured in
 * tokens and the next in API calls, so a donut whose centre added those two
 * together would be a total of nothing. Every feature's events are the same
 * kind of thing, so they sum, and the centre figure is a number that exists.
 *
 * Revenue per feature would be the better slice and is not on offer — the
 * analytics response carries one subtotal for the whole window, not one per
 * item — which the description says rather than leaving the title to imply it.
 */
function MixPanel({
  mix,
  rangeLabel,
  onViewFeatures,
}: {
  mix: RevenueDashboardProps['mix']
  rangeLabel: string
  onViewFeatures: () => void
}) {
  return (
    <Panel
      title="Revenue mix"
      description={`Metered events by feature, ${rangeLabel}`}
      action={<PanelButton onClick={onViewFeatures}>All features</PanelButton>}
    >
      <div className="flex flex-1 flex-col justify-center p-6">
        {mix.status === 'ready' && mix.slices.length > 0 ? (
          <HalfDonut
            /*
             * Categorical tones in fixed order, except the folded tail: a
             * remainder is not a category, so it takes `neutral` — the tone
             * `charts.tsx` reserves for exactly that — rather than borrowing a
             * series slot and reading as one more feature.
             */
            slices={mix.slices.map((slice, index) => ({
              ...slice,
              tone: slice.id === 'other' ? ('neutral' as const) : seriesTone(index),
            }))}
            centerLabel="Events"
            centerValue={compact.format(mix.total)}
            format={(value) => compact.format(value)}
            label={`Metered events by feature, ${rangeLabel}`}
          />
        ) : mix.status === 'unavailable' ? (
          <AbsentFigure caption="Usage analytics could not be loaded for this window." />
        ) : (
          <AbsentFigure caption={`No metered events were ingested in the ${rangeLabel}.`} />
        )}
      </div>
    </Panel>
  )
}

/* ---- 3. Gross margin ---------------------------------------------------- */

/**
 * Where a margin stops being healthy.
 *
 * `ArcGauge` does not threshold — it takes a tone and paints it, because where
 * "bad" starts is a product question and a shared chart component is the wrong
 * place to answer it. This surface is the right place, and answering it once
 * here is what keeps the gauge from being asked to guess.
 */
function marginTone(percent: number): 'good' | 'warning' | 'critical' {
  if (percent >= 60) return 'good'
  if (percent >= 40) return 'warning'
  return 'critical'
}

function MarginPanel({
  margin,
  onCostSheets,
}: {
  margin: RevenueDashboardProps['margin']
  onCostSheets: () => void
}) {
  return (
    <Panel
      title="Gross margin"
      description="Revenue after cost sheets"
      action={<PanelButton onClick={onCostSheets}>Cost sheets</PanelButton>}
    >
      <div className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          {margin.status === 'ready' && margin.percent !== null ? (
            <>
              <ArcGauge
                value={margin.percent}
                max={100}
                display=""
                tone={marginTone(margin.percent)}
                label="Gross margin on metered revenue"
              />
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-medium tabular-nums">
                  {Math.round(margin.percent)}%
                </span>
                <span className="text-muted-foreground text-xs">gross margin</span>
              </div>
            </>
          ) : (
            <AbsentFigure caption={margin.reason} />
          )}
        </div>

        {/*
         * Revenue, cost and profit are the three figures the design draws and
         * the three that cannot be summed here (`Money` has no `add`), so they
         * keep their place as dashes rather than vanishing.
         */}
        <dl className="grid grid-cols-3 divide-x border-t pt-4 text-center">
          {['Revenue', 'Cost', 'Gross profit'].map((label) => (
            <div key={label} className="space-y-1 px-2">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-[15px] font-medium tabular-nums">{NOTHING}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}

/* ---- 3b. Revenue by customer -------------------------------------------- */

/**
 * The table that is only partly here, and precisely why.
 *
 * The redesign asks for a per-customer list: Customer, Plan, Net revenue,
 * Contract, Usage, Cost, Margin %. Five of those seven are money, and the
 * audit behind this panel found that **no endpoint returns revenue grouped by
 * customer**. Three separate findings, and they are not the same kind of gap:
 *
 *   - `POST /analytics/revenue` is **absent from the SDK but live on the
 *     server**, where it answers `403 "Enable the revenue_analytics_config
 *     setting to use revenue analytics"`. So it is switched off for this
 *     environment rather than missing — and `GET
 *     /settings/revenue_analytics_config` answers `400 Unknown setting key`,
 *     so it is not the console's own settings API that turns it on. Somebody
 *     with backend access has to, and that is a far more actionable sentence
 *     than "no endpoint exists".
 *   - `POST /events/analytics` exists, but its `group_by` accepts only
 *     `source`, `feature_id` and `properties.*` — never a customer.
 *   - `POST /costs/analytics` exists, is in the SDK as
 *     `costs.getDetailedCostAnalytics`, and **does return `total_revenue`,
 *     `total_cost`, `margin` and `margin_percent`** — but for the tenant as a
 *     whole, or one `external_customer_id` per request.
 *
 * So this could only be drawn by issuing one request per row and stitching
 * the answers together, or by summing invoice totals in the browser — which
 * `money.ts` refuses outright, on the grounds that a UI which recomputes a
 * total will eventually disagree with the invoice the customer was charged.
 *
 * With rows, the reference's list. Without them, the reference's dashed empty
 * box carrying the reason, and the columns as what they are: named gaps a
 * reader — or whoever picks up the backend ticket — can act on. The version
 * this dashboard replaced was five named customers with their spend, and not
 * one of those figures came from anywhere.
 */
const BY_CUSTOMER_COLUMNS: SimpleColumn<RevenueByCustomerRow>[] = [
  {
    key: 'customer',
    header: 'Customer',
    cell: (row) => <span className="text-[13px] font-medium">{row.customer}</span>,
  },
  {
    key: 'plan',
    header: 'Plan',
    cell: (row) => <span className="text-muted-foreground text-[13px]">{row.plan}</span>,
  },
  {
    key: 'net',
    header: 'Net revenue',
    cell: (row) => <span className="tabular-nums">{row.netRevenue}</span>,
  },
  {
    key: 'contract',
    header: 'Contract',
    cell: (row) => <span className="text-muted-foreground tabular-nums">{row.contract}</span>,
  },
  {
    key: 'usage',
    header: 'Usage',
    cell: (row) => <span className="text-muted-foreground tabular-nums">{row.usage}</span>,
  },
  {
    key: 'cost',
    header: 'Cost',
    cell: (row) => <span className="text-muted-foreground tabular-nums">{row.cost}</span>,
  },
  {
    key: 'margin',
    header: 'Margin',
    cell: (row) => <span className="tabular-nums">{row.margin}</span>,
  },
]

function RevenueByCustomerPanel({
  byCustomer,
  onViewCustomers,
}: {
  byCustomer: RevenueDashboardProps['byCustomer']
  onViewCustomers: () => void
}) {
  const rows = byCustomer.rows ?? []

  return (
    <section aria-labelledby="revenue-by-customer" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pt-4">
        <h2 id="revenue-by-customer" className="text-sm font-medium">
          Revenue by customer
        </h2>
        <PanelButton onClick={onViewCustomers}>All customers</PanelButton>
      </div>

      {rows.length > 0 ? (
        <div className="bg-background overflow-hidden rounded-xl border">
          <SimpleTable columns={BY_CUSTOMER_COLUMNS} rows={rows} getRowId={(row) => row.id} />
        </div>
      ) : (
        <div className="text-muted-foreground rounded-xl border border-dashed px-5 py-10 text-center text-[13px]">
          <Unavailable
            what={byCustomer.reason}
            className="mx-auto max-w-[80ch] text-[13px] text-balance"
          />
          {byCustomer.status === 'unavailable' ? (
            /*
             * What each column waits on. A body of em dashes would read as
             * "these customers earned nothing" rather than "this cannot be
             * asked".
             */
            <dl className="divide-border/60 mx-auto mt-6 max-w-3xl divide-y text-left text-xs">
              {byCustomer.columns.map((gap) => (
                <div key={gap.column} className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
                  <dt className="text-foreground font-medium">{gap.column}</dt>
                  <dd className="text-muted-foreground text-balance">{gap.blocker}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      )}
    </section>
  )
}

/* ---- 4. Collections ----------------------------------------------------- */

/**
 * How much of what was invoiced has been collected.
 *
 * `total` is deliberately **omitted**, and the choice matters. Given a total,
 * `SplitMeter` draws the shortfall as unfilled track — the right mark for a
 * drawdown against a commitment. Here the three parts are the states the domain
 * derives, and every finalised invoice is in exactly one of them, so they are
 * exhaustive: a ceiling would draw a gap that can never open. The honest
 * drawdown — amount collected against amount billed — would need the two money
 * totals summed across invoices, which is precisely what `Money` refuses. The
 * headline is therefore the share of invoices that are paid, a count.
 *
 * Status tones rather than categorical ones, because paid, open and overdue are
 * states and not merely three different things.
 */
function CollectionsPanel({
  collections,
  rangeLabel,
  onViewInvoices,
}: {
  collections: RevenueDashboardProps['collections']
  rangeLabel: string
  onViewInvoices: () => void
}) {
  const total = collections.paid + collections.open + collections.overdue
  const paidShare = total > 0 ? Math.round((collections.paid / total) * 100) : 0

  return (
    <Panel
      title="Collections"
      description={`Invoiced ${rangeLabel}, by payment state`}
      action={<PanelButton onClick={onViewInvoices}>View invoices</PanelButton>}
    >
      <div className="flex flex-1 flex-col gap-6 p-6">
        {collections.status === 'ready' && total > 0 ? (
          <SplitMeter
            parts={[
              { id: 'paid', label: 'Paid', value: collections.paid, tone: 'good' },
              { id: 'open', label: 'Open', value: collections.open, tone: 'warning' },
              { id: 'overdue', label: 'Overdue', value: collections.overdue, tone: 'critical' },
            ]}
            value={`${paidShare}%`}
            title="of invoices paid"
            format={(value) => whole.format(value)}
            label={`Collections: ${total} invoices finalised ${rangeLabel}, by state`}
          />
        ) : collections.status === 'unavailable' ? (
          <AbsentFigure caption="Invoices could not be loaded." />
        ) : (
          <AbsentFigure caption={`No invoices were finalised in the ${rangeLabel}.`} />
        )}
      </div>
    </Panel>
  )
}

/* ---- The surface -------------------------------------------------------- */

export function RevenueDashboard({
  rangeLabel,
  chart,
  meteredRevenue,
  mix,
  margin,
  collections,
  byCustomer,
  onNavigate,
}: RevenueDashboardProps): ReactNode {
  const go = (path: string) => onNavigate?.(path)

  // The reference hides the three panels until there is revenue to report.
  const firstRun =
    chart.status === 'empty' && mix.status === 'empty' && collections.status === 'empty'

  return (
    <div className="flex flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      {/* The visible title lives in the shell's breadcrumb; the outline still needs one. */}
      <h1 className="sr-only">Revenue</h1>

      <RangeRow rangeLabel={rangeLabel} />

      <MetricPanel
        chart={chart}
        meteredRevenue={meteredRevenue}
        rangeLabel={rangeLabel}
        onGetStarted={() => go('/features')}
        onSeePlans={() => go('/plans')}
      />

      {firstRun ? null : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <MixPanel mix={mix} rangeLabel={rangeLabel} onViewFeatures={() => go('/features')} />
          <MarginPanel margin={margin} onCostSheets={() => go('/cost-sheets')} />
          <CollectionsPanel
            collections={collections}
            rangeLabel={rangeLabel}
            onViewInvoices={() => go('/invoices')}
          />
        </div>
      )}

      <RevenueByCustomerPanel byCustomer={byCustomer} onViewCustomers={() => go('/customers')} />
    </div>
  )
}
