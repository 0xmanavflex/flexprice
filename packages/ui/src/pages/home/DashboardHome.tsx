import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRightIcon, CalendarIcon } from 'lucide-react'
import type { Money as MoneyValue } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Panel } from '@ui/compositions/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ArcGauge } from '../shared/ArcGauge'
import { BlurredEmpty, MetricChart } from '../shared/charts'
import type { MetricTab } from '../shared/charts'
import { HalfDonut } from '../shared/HalfDonut'
import type { DonutSlice } from '../shared/HalfDonut'
import { Money } from '../shared/Money'
import { PillColumns } from '../shared/PillColumns'
import type { PillColumn, PillSeries } from '../shared/PillColumns'
import { MeterTrack, SegmentMeter } from '../shared/SegmentMeter'
import type { SegmentMeterRow } from '../shared/SegmentMeter'

/**
 * Home — the console's overview.
 *
 * What this replaces is the point of it. Home used to render a vendored sample
 * dashboard with its own numbers baked in, and a live-data audit called it a
 * blocker: the first screen of a billing console greeted people with metrics
 * from a different product entirely. The numbers were not merely placeholder,
 * they were *confident* — a card badged "Live", a cost figure identical to the
 * call count beside it, dates hardcoded to a week in August.
 *
 * So the rule this surface is built to is: **every number on it is either read
 * from the API or absent.** There is no third category. Where Flexprice has no
 * endpoint — processing lag, request latency, error counts — the panel says so
 * in words rather than showing a plausible figure. That is the same choice
 * `SettingsUnavailable` and `ShellSearch` already made, and it is the only way
 * a dashboard stays trustworthy once one number on it is wrong.
 *
 * This component is deliberately **presentational**. It takes the data already
 * resolved and holds no queries of its own, which is what lets its story
 * exercise the populated, empty and unavailable states as first-class cases
 * rather than as whatever the network happened to do.
 *
 * Every mark on it now comes from the shared chart library rather than from a
 * ReUI block adapted in place: `MetricChart` for the revenue, customer and
 * usage-ingestion strip and the series it switches between, `PillColumns` for the per-day subscription stack,
 * `HalfDonut` for the invoice gauge, `SegmentMeter` for the per-feature usage
 * rows, `ArcGauge` for key health, and `BlurredEmpty` for the first run. The
 * blocks those components were composed from are declared there; what this file
 * keeps is the *wiring* — which panel is ready, empty or unavailable, and which
 * numbers are allowed on screen at all.
 *
 * One consequence worth naming: no panel here picks a colour. Each passes a
 * `ChartTone`, and the categorical/status split is honoured — `series-*` for
 * plans, which are merely different from one another, and `good`/`warning`/
 * `critical` only for invoice payment state and key health, which are
 * judgements.
 *
 * The usage-by-feature meter and the API key gauge are parked: their JSX is
 * commented out in `DashboardHome` until quota-based metrics land, but the
 * components stay here, compiled, so they return without a rebuild.
 */
export const DashboardHomeProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/PillColumns',
    'pages/shared/HalfDonut',
    'pages/shared/SegmentMeter',
    'pages/shared/ArcGauge',
    'ui/select',
    'compositions/Section',
  ],
  note: 'Billing overview: revenue, customers and usage ingestion, contracts and invoice payment status (metered usage and API keys parked), drawn with the shared chart library. Every figure is API-sourced or explicitly unavailable. Lineage: pages/shared/MetricChart, pages/shared/BlurredEmpty.',
})

/* ---- What the page is told ---------------------------------------------- */

/**
 * Why a panel is showing what it is showing.
 *
 * `empty` and `unavailable` are separate on purpose, and the distinction is the
 * whole design: `empty` means the API answered and there is nothing yet, which
 * deserves an invitation to start. `unavailable` means Flexprice cannot answer
 * the question at all, which deserves an explanation and no invitation.
 */
export type PanelStatus = 'loading' | 'ready' | 'empty' | 'unavailable'

export interface FilterOption {
  id: string
  label: string
}

/** One bucket of the ingestion series. */
export interface EventPoint {
  /** Axis label, already formatted for the chosen granularity. */
  label: string
  events: number
}

export interface EventsPanel {
  status: PanelStatus
  points: EventPoint[]
  /** Events ingested across the window. */
  total: number | null
  /** What the server priced this usage at. `null` when it sent no subtotal. */
  revenue: MoneyValue | null
}

/**
 * One column of the subscription stack, split by plan.
 *
 * Usually a day, and named after one. `PillColumns` is a countable mark rather
 * than a dense one, so a window too long for a column per day is bucketed by
 * the page and `label` then names the run it covers ("23–27 Sep"). This
 * component draws whatever columns it is handed; deciding how wide they are is
 * the page's job, because only the page knows the window.
 */
export interface SubscriptionDay {
  label: string
  /** Plan name to count. Only plans present in `plans` are drawn. */
  byPlan: Record<string, number>
}

export interface SubscriptionsPanel {
  status: PanelStatus
  total: number
  /** Change against the window before this one. `null` when there is no prior window to compare. */
  changePercent: number | null
  /** The columns of the stack, oldest first. */
  days: SubscriptionDay[]
  /** Plans that appear in the window, busiest first. Drives both the columns and the legend. */
  plans: { name: string; count: number }[]
}

export interface InvoicesPanel {
  status: PanelStatus
  total: number
  paid: number
  open: number
  overdue: number
}

/**
 * New customers across the window, for the Customers tab.
 *
 * Counted by the page from the customers' own creation dates, so the headline
 * and the series are the same measurement and always agree.
 */
export interface CustomersPanel {
  status: PanelStatus
  /** Customers created inside the window. `null` when it could not be counted. */
  newCount: number | null
  /**
   * `true` when the page could only see the newest customers and every one of
   * them fell inside the window — so `newCount` is a floor, not a total, and is
   * shown with a `+` rather than as an exact figure.
   */
  partial: boolean
  /** New customers per bucket, oldest first. */
  points: { label: string; customers: number }[]
}

export interface UsageRow {
  featureId: string
  name: string
  /** The feature's lookup key — shown under the name as `code.key`. */
  lookupKey: string
  /**
   * The metered quantity as a number.
   *
   * The meter compares features to each other, so it needs the figure and not
   * only its rendering — "428K calls" and "1.8M tokens" cannot be ranked as
   * strings.
   */
  quantity: number
  /** The same quantity formatted with its unit, e.g. "428K calls". What is shown. */
  value: string
  changePercent: number | null
}

export interface UsagePanel {
  status: PanelStatus
  rows: UsageRow[]
}

export interface ApiPanel {
  status: PanelStatus
  activeKeys: number
  totalKeys: number
  /** When a key was last used, already formatted. `null` when none ever has been. */
  lastUsedLabel: string | null
}

export interface DashboardHomeProps {
  rangeOptions: FilterOption[]
  range: string
  onRangeChange: (range: string) => void

  granularityOptions: FilterOption[]
  granularity: string
  onGranularityChange: (granularity: string) => void

  customerOptions: FilterOption[]
  customer: string
  onCustomerChange: (customer: string) => void

  /** Words for the window, e.g. "last 7 days". Used in the panels' subtitles. */
  rangeLabel: string

  events: EventsPanel
  customers: CustomersPanel
  subscriptions: SubscriptionsPanel
  invoices: InvoicesPanel
  /**
   * Usage by feature and API key health. Not rendered at the moment — both
   * panels are parked until quota-based metrics land (see `DashboardHome`) —
   * so the page need not fetch them. Kept on the contract so they return
   * without a props change.
   */
  usage?: UsagePanel | undefined
  api?: ApiPanel | undefined

  /** Where a link on the overview leads. No-op by default, so the surface renders in isolation. */
  onNavigate?: (path: string) => void
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
 * Not "coming soon" and not a zero — the metric is named, and the reason it is
 * missing is stated. `role="status"` so it is announced rather than only blank.
 */
function Unavailable({ what, className }: { what: string; className?: string }) {
  return (
    <p role="status" className={cn('text-muted-foreground text-xs', className)}>
      {what}
    </p>
  )
}

/* ---- 1. Filters --------------------------------------------------------- */

interface Filter {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  icon?: ReactNode
}

function FilterSelect({ filter }: { filter: Filter }) {
  return (
    <Select
      value={filter.value}
      // Base UI's `Select.Value` renders the raw value unless the root can
      // map it to a label — without this the filters read "7d", "daily",
      // "all". `chart-16` passes `items` for the same reason.
      items={filter.options.map((option) => ({ value: option.id, label: option.label }))}
      // Base UI's Select can clear to `null`; these filters always have a
      // selection, so a clear is simply ignored rather than widening every
      // handler in the page to accept an absent filter.
      onValueChange={(value) => {
        if (value !== null) filter.onChange(value)
      }}
    >
      <SelectTrigger aria-label={filter.label}>
        {filter.icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" aria-label={filter.label}>
        {filter.options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The filter rows.
 *
 * The range sits on its own at the top of the page because it is the only
 * filter every panel obeys — the metrics, the contracts and the invoices are
 * all cut to the same window. Granularity and customer only shape the metric
 * chart, so they stay in the row directly above it.
 *
 * The design also drew an "+ Add filter" control. It is left out rather than
 * drawn dead: this console already learned from a global search box that
 * swallowed what you typed (see `ShellSearch`) that a control which does
 * nothing is worse than a control that is not there.
 */
function RangeFilter(props: {
  rangeOptions: FilterOption[]
  range: string
  onRangeChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        filter={{
          label: 'Range',
          value: props.range,
          options: props.rangeOptions,
          onChange: props.onRangeChange,
          icon: <CalendarIcon aria-hidden className="size-3.5" />,
        }}
      />
    </div>
  )
}

function ChartFilters(props: {
  granularityOptions: FilterOption[]
  granularity: string
  onGranularityChange: (value: string) => void
  customerOptions: FilterOption[]
  customer: string
  onCustomerChange: (value: string) => void
}) {
  const filters: Filter[] = [
    {
      label: 'Granularity',
      value: props.granularity,
      options: props.granularityOptions,
      onChange: props.onGranularityChange,
    },
    {
      label: 'Customer',
      value: props.customer,
      options: props.customerOptions,
      onChange: props.onCustomerChange,
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterSelect key={filter.label} filter={filter} />
      ))}
    </div>
  )
}

/* ---- 2. Key metrics ---------------------------------------------------- */

const METRIC_REVENUE = 'revenue'
const METRIC_CUSTOMERS = 'customers'
const METRIC_EVENTS = 'events'
const METRIC_LAG = 'lag'

/**
 * The shape behind the first-run message.
 *
 * It is not data and never becomes data: `BlurredEmpty` renders its children
 * `aria-hidden`, `inert` and blurred, and `MetricChart` hides its y-axis, so
 * this is a line with no scale, no axis and no tooltip — a texture that says
 * "a chart goes here". The tab headlines above it stay dashes, because those
 * *are* legible.
 */
const PLACEHOLDER_SHAPE = [46, 61, 54, 72, 65, 83, 74, 91, 86, 104, 97, 112].map((value) => ({
  label: '',
  value,
}))

function MetricsSection({
  events,
  customers,
  rangeLabel,
  filters,
  onQuickstart,
}: {
  events: EventsPanel
  customers: CustomersPanel
  rangeLabel: string
  /** The chart's own filters (granularity, customer), drawn above it. */
  filters: ReactNode
  onQuickstart: () => void
}) {
  // Which metric you are looking at is view state, not data, so it lives here
  // rather than in the props. `MetricChart` holds none of its own. Revenue is
  // what the overview is opened for, so it is the tab you land on.
  const [metric, setMetric] = useState(METRIC_REVENUE)

  const eventsReady = events.status === 'ready'
  const customersReady = customers.status === 'ready'
  // The chart is drawn as soon as either source has something to show; the
  // first-run invitation is for an account with neither.
  const ready = eventsReady || customersReady

  /**
   * The tab strip is the stat strip, in the order the overview is read:
   * Revenue, Customers, Usage ingestion — then Processing lag.
   *
   * Two of them have no series to plot: the usage API prices a window as a
   * whole rather than per bucket, and processing lag is not measured anywhere
   * in the stack. Both keep their tab — dropping them would make "not plotted"
   * and "not a thing we track" look identical — and `caption` below carries
   * the reason.
   */
  const tabs: MetricTab[] = [
    {
      id: METRIC_REVENUE,
      label: 'Revenue',
      // The server's own subtotal, or nothing. `Money` has no `add`, and
      // summing prices across currencies in the browser would be the wrong
      // answer rendered confidently.
      value: eventsReady && events.revenue !== null ? <Money value={events.revenue} /> : NOTHING,
      points: [],
    },
    {
      id: METRIC_CUSTOMERS,
      label: 'Customers',
      value:
        customersReady && customers.newCount !== null
          ? `${whole.format(customers.newCount)}${customers.partial ? '+' : ''}`
          : NOTHING,
      points: customersReady
        ? customers.points.map((point) => ({ label: point.label, value: point.customers }))
        : [],
    },
    {
      id: METRIC_EVENTS,
      label: 'Usage ingestion',
      value: eventsReady && events.total !== null ? compact.format(events.total) : NOTHING,
      points: eventsReady
        ? events.points.map((point) => ({ label: point.label, value: point.events }))
        : [],
    },
    {
      /*
       * Processing lag has no endpoint anywhere in the stack — not in
       * `@fp/query`, not in `@fp/api`, and not in the SDK, which exposes
       * per-event debugging but no aggregate. It is shown as absent, with the
       * reason, rather than dropped.
       */
      id: METRIC_LAG,
      label: 'Processing lag',
      value: NOTHING,
      points: [],
    },
  ]

  const caption =
    metric === METRIC_REVENUE
      ? 'Revenue is priced for the window as a whole; the usage API returns no per-bucket figure to plot.'
      : metric === METRIC_CUSTOMERS
        ? `New customers, ${rangeLabel}.`
        : metric === METRIC_EVENTS
          ? `Usage events received, ${rangeLabel}.`
          : undefined

  const placeholder: MetricTab[] = tabs.map((tab) =>
    tab.id === METRIC_REVENUE ? { ...tab, points: PLACEHOLDER_SHAPE } : tab,
  )

  const chart = (
    <MetricChart
      tabs={tabs}
      activeTab={metric}
      onTabChange={setMetric}
      caption={caption}
      height={240}
    />
  )

  return (
    <section aria-label="Key metrics" className="flex min-w-0 flex-col gap-3">
      <h2 className="sr-only">Key metrics</h2>
      {filters}
      {ready ? (
        chart
      ) : (
        /*
         * The invitation sits over a blurred chart rather than replacing it, so
         * the shape of what will appear is visible while it is still empty —
         * the design's own choice, and it keeps the panel from collapsing and
         * shifting everything below it the moment data arrives.
         */
        <BlurredEmpty
          title={
            events.status === 'unavailable'
              ? 'Usage analytics unavailable'
              : events.status === 'loading'
                ? 'Loading events'
                : 'No events yet'
          }
          description={
            events.status === 'unavailable'
              ? 'Flexprice could not load events for this window. Try again in a moment.'
              : events.status === 'loading'
                ? 'Fetching usage analytics for this window.'
                : 'Send your first usage event and this chart shows revenue, customers and usage ingestion as it happens.'
          }
          action={
            events.status === 'empty' ? { label: 'Quickstart', onClick: onQuickstart } : undefined
          }
          secondaryAction={
            events.status === 'empty'
              ? { label: 'Send test event', onClick: onQuickstart }
              : undefined
          }
        >
          <MetricChart
            tabs={placeholder}
            activeTab={METRIC_REVENUE}
            onTabChange={() => {}}
            height={240}
          />
        </BlurredEmpty>
      )}

      {eventsReady && events.revenue === null ? (
        <Unavailable what="The usage API returned no priced subtotal for this window." />
      ) : null}
      {ready && metric === METRIC_CUSTOMERS && customers.status === 'unavailable' ? (
        <Unavailable what="Customers could not be loaded." />
      ) : null}
      {ready && metric === METRIC_EVENTS && events.status === 'unavailable' ? (
        <Unavailable what="Usage analytics could not be loaded." />
      ) : null}
      {metric === METRIC_LAG ? (
        <Unavailable what="Flexprice does not expose an ingestion-lag metric." />
      ) : null}
    </section>
  )
}

/* ---- 3. Recent subscriptions -------------------------------------------- */

function SubscriptionsCard({
  subscriptions,
  rangeLabel,
  onViewAll,
}: {
  subscriptions: SubscriptionsPanel
  rangeLabel: string
  onViewAll: () => void
}) {
  const { status, plans, days, total, changePercent } = subscriptions
  const ready = status === 'ready'

  // Plans are categories, not states, so they take the categorical slots in
  // order — `PillColumns` hands those out itself when no tone is given.
  const series: PillSeries[] = plans.map((plan) => ({ id: plan.name, label: plan.name }))
  const columns: PillColumn[] = days.map((day) => ({ label: day.label, values: day.byPlan }))

  return (
    <Panel
      title="Recent contracts"
      action={
        <Button variant="outline" size="sm" onClick={onViewAll}>
          View all
        </Button>
      }
    >
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-baseline gap-2">
          <span
            className={cn('text-4xl font-medium tabular-nums', !ready && 'text-muted-foreground')}
          >
            {ready ? total : 0}
          </span>
          <span className="text-muted-foreground text-xs">new contracts</span>
          {ready && changePercent !== null ? (
            <span
              className={cn(
                'ml-auto text-xs font-medium',
                changePercent >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {changePercent >= 0 ? '+' : ''}
              {new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(changePercent)}
              %{' vs prior period'}
            </span>
          ) : null}
        </div>

        {ready ? (
          <PillColumns
            columns={columns}
            series={series}
            label={`New contracts by plan, ${rangeLabel}`}
          />
        ) : (
          <>
            {/* The same matrix with nothing lit — which is what the chart draws
                for an all-zero window anyway, so the shape never jumps as the
                data arrives. */}
            <div className="flex min-h-32 w-full items-end gap-2" aria-hidden>
              {Array.from({ length: 7 }, (_, column) => (
                <div key={column} className="flex min-w-0 flex-1 flex-col justify-end gap-1">
                  {Array.from({ length: 7 }, (_, row) => (
                    <span key={row} className="bg-muted/70 h-3 rounded" />
                  ))}
                </div>
              ))}
            </div>
            {status === 'unavailable' ? (
              <Unavailable what="Contracts could not be loaded." />
            ) : (
              <p className="text-muted-foreground border-t pt-4 text-xs">
                Contracts created in this period appear here, by plan.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

/* ---- 4. Invoice payment status ------------------------------------------ */

/**
 * The half-donut over real invoice counts.
 *
 * The three slices are the three states the domain actually models — paid, open
 * and overdue. The design labelled them paid/pending/failed, which are wire
 * `payment_status` values that `deriveInvoiceStatus` collapses; using the
 * domain's own vocabulary is what keeps this panel agreeing with the invoice
 * list it links to.
 *
 * These are states, so they take the status tones rather than the categorical
 * ones. Overdue is `critical` because overdue is bad, not because it was third
 * in the rotation.
 */
function InvoicesCard({
  invoices,
  onViewInvoices,
}: {
  invoices: InvoicesPanel
  onViewInvoices: () => void
}) {
  const ready = invoices.status === 'ready'
  const slices: DonutSlice[] = [
    { id: 'paid', label: 'Paid', value: ready ? invoices.paid : 0, tone: 'good' },
    { id: 'open', label: 'Open', value: ready ? invoices.open : 0, tone: 'warning' },
    { id: 'overdue', label: 'Overdue', value: ready ? invoices.overdue : 0, tone: 'critical' },
  ]

  return (
    <Panel
      title="Invoice payment status"
      action={
        <Button variant="outline" size="sm" onClick={onViewInvoices}>
          View invoices
        </Button>
      }
    >
      {invoices.status === 'unavailable' ? (
        // Zeroes would be a claim. A window that could not be read gets the
        // reason instead of a ring and three noughts.
        <div className="flex flex-1 flex-col justify-center p-6">
          <Unavailable what="Invoices could not be loaded." />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center p-6">
          <HalfDonut
            slices={slices}
            centerLabel="Invoices"
            centerValue={ready ? invoices.total : 0}
            label="Invoice payment status"
          />
        </div>
      )}
    </Panel>
  )
}

/* ---- 5. Usage by feature ------------------------------------------------ */

/*
 * Parked: not rendered until quota-based metrics land (see `DashboardHome`).
 * Exported only so the component stays compiled and type-checked meanwhile;
 * it is not part of the pages barrel.
 */
export function UsageCard({
  usage,
  onViewFeatures,
  className,
}: {
  usage: UsagePanel
  onViewFeatures: () => void
  className?: string
}) {
  const rows: SegmentMeterRow[] = usage.rows.map((row) => ({
    id: row.featureId,
    label: row.name,
    caption: row.lookupKey,
    value: row.quantity,
    // No `max`: these features have no shared ceiling, so each row is measured
    // against the busiest one and the panel answers "which feature is carrying
    // this account" rather than "how full is it".
    display: row.value,
    changePercent: row.changePercent ?? undefined,
  }))

  return (
    <Panel
      title="Usage by feature"
      action={
        <Button variant="outline" size="sm" onClick={onViewFeatures}>
          All features
        </Button>
      }
      {...(className !== undefined ? { className } : {})}
    >
      {usage.status === 'unavailable' ? (
        <div className="flex flex-1 flex-col justify-center px-6 py-5">
          <Unavailable what="Usage analytics could not be loaded." />
        </div>
      ) : usage.status === 'ready' && rows.length > 0 ? (
        <SegmentMeter rows={rows} label="Usage by feature" className="px-6 py-1" />
      ) : (
        <div className="grid flex-1 grid-cols-[minmax(0,11rem)_minmax(0,1fr)] content-center items-center gap-6 px-6 py-5">
          <span className="text-muted-foreground text-[13px]">No usage recorded yet</span>
          <MeterTrack filled={0} segments={40} />
        </div>
      )}
    </Panel>
  )
}

/* ---- 6. API ------------------------------------------------------------- */

/**
 * Key health, as an arc.
 *
 * The design used this gauge for a request success rate; Flexprice exposes no
 * request metrics at all, so it shows a ratio that *is* real — how many of the
 * tenant's API keys are active, against how many exist. The mark is reused, the
 * claim is not, and `max` is a real denominator rather than an invented one.
 *
 * The tone is the page's judgement, not the gauge's: `ArcGauge` never decides
 * that a reading is bad.
 */
// Parked alongside `UsageCard`; exported for the same reason.
export function ApiCard({ api, onApiKeys }: { api: ApiPanel; onApiKeys: () => void }) {
  const ready = api.status === 'ready' && api.totalKeys > 0
  const healthy = api.activeKeys === api.totalKeys

  return (
    <Panel
      title="API"
      action={
        <Button variant="outline" size="sm" onClick={onApiKeys}>
          API keys
          <ArrowUpRightIcon aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-6 p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          {api.status === 'unavailable' ? (
            <Unavailable what="API keys could not be loaded." />
          ) : ready ? (
            <ArcGauge
              value={api.activeKeys}
              max={api.totalKeys}
              display={healthy ? 'Healthy' : 'Attention'}
              caption={`${whole.format(api.activeKeys)} of ${whole.format(api.totalKeys)} keys active`}
              tone={healthy ? 'good' : 'warning'}
              label="API keys active"
            />
          ) : (
            <ArcGauge
              value={0}
              max={1}
              display="Waiting for first request"
              caption="Create an API key to start sending events"
              label="No API keys yet"
            />
          )}
        </div>

        {/*
         * Requests, p95 and errors are the three numbers the design asked for and
         * the three this console cannot get. There is no observability surface in
         * the API or the SDK — only per-event debugging — so they are shown as
         * absent with the reason, in the same shape they would take if they
         * arrived.
         */}
        <dl className="grid grid-cols-3 divide-x border-t pt-4 text-center">
          {[
            { label: 'Requests', value: NOTHING },
            { label: 'p95 latency', value: NOTHING },
            { label: 'Errors', value: NOTHING },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1 px-2">
              <dt className="text-muted-foreground text-xs">{stat.label}</dt>
              <dd className="text-[15px] font-medium tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}

/* ---- The surface -------------------------------------------------------- */

export function DashboardHome({
  rangeOptions,
  range,
  onRangeChange,
  granularityOptions,
  granularity,
  onGranularityChange,
  customerOptions,
  customer,
  onCustomerChange,
  rangeLabel,
  events,
  customers,
  subscriptions,
  invoices,
  onNavigate,
}: DashboardHomeProps) {
  const go = (path: string) => onNavigate?.(path)

  return (
    <div className="flex flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      {/* The visible title lives in the shell's breadcrumb; the outline still needs one. */}
      <h1 className="sr-only">Overview</h1>

      <RangeFilter rangeOptions={rangeOptions} range={range} onRangeChange={onRangeChange} />

      <MetricsSection
        events={events}
        customers={customers}
        rangeLabel={rangeLabel}
        filters={
          <ChartFilters
            granularityOptions={granularityOptions}
            granularity={granularity}
            onGranularityChange={onGranularityChange}
            customerOptions={customerOptions}
            customer={customer}
            onCustomerChange={onCustomerChange}
          />
        }
        onQuickstart={() => go('/features')}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SubscriptionsCard
          subscriptions={subscriptions}
          rangeLabel={rangeLabel}
          onViewAll={() => go('/subscriptions')}
        />
        <InvoicesCard invoices={invoices} onViewInvoices={() => go('/invoices')} />
      </div>

      {/*
       * Usage by feature and the API panel are parked until quota-based
       * metrics land, when they return in this shape. The components
       * (`UsageCard`, `ApiCard`) and their panel types are kept intact.
       *
       * <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
       *   <UsageCard usage={usage} onViewFeatures={() => go('/features')} className="xl:col-span-2" />
       *   <ApiCard api={api} onApiKeys={() => go('/settings')} />
       * </div>
       */}
    </div>
  )
}
