import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRightIcon, CalendarIcon } from '@ui/icons'
import { formatMoney, type Money as MoneyValue } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Calendar } from '@ui/components/primitives/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { DataFreshness, DataRegion } from '@ui/compositions/feedback/DataBoundary'
import { EMPTY_CATALOGUE } from '@ui/compositions/feedback/emptyCatalogue'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { ChartSkeleton, ValuePlaceholder } from '@ui/compositions/feedback/Skeletons'
import { Panel } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ArcGauge } from '../shared/ArcGauge'
import { BlurredEmpty, MetricChart } from '../shared/charts'
import type { MetricTab, MetricTabStatus } from '../shared/charts'
import { HalfDonut } from '../shared/HalfDonut'
import type { DonutSlice } from '../shared/HalfDonut'
import { Money } from '../shared/Money'
import { PillColumns } from '../shared/PillColumns'
import type { PillColumn, PillSeries } from '../shared/PillColumns'
import { MeterTrack, SegmentMeter } from '../shared/SegmentMeter'
import type { SegmentMeterRow } from '../shared/SegmentMeter'

/**
 * Home: the console's overview.
 *
 * What this replaces is the point of it. Home used to render a vendored sample
 * dashboard with its own numbers baked in, and a live-data audit called it a
 * blocker: the first screen of a billing console greeted people with metrics
 * from a different product entirely. The numbers were not merely placeholder,
 * they were *confident*: a card badged "Live", a cost figure identical to the
 * call count beside it, dates hardcoded to a week in August.
 *
 * So the rule this surface is built to is: **every number on it is either read
 * from the API or absent.** There is no third category. Where Flexprice has no
 * endpoint: request latency and error counts: the panel says so
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
 * keeps is the *wiring*: which panel is ready, empty or unavailable, and which
 * numbers are allowed on screen at all.
 *
 * One consequence worth naming: no panel here picks a colour. Each passes a
 * `ChartTone`, and the categorical/status split is honoured: `series-*` for
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
    'compositions/feedback/DataBoundary',
    'compositions/feedback/emptyCatalogue',
    'compositions/feedback/RetryAction',
    'compositions/feedback/Skeletons',
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

/**
 * What a panel can tell the reader about the *quality* of what it shows, beyond
 * its status. All optional: a story that passes none gets the plain panel.
 *
 * The rule behind them is that data on screen beats a spinner or an error. A
 * refetch that fails over good data is `status: 'ready'` with `stale: true`,
 * never `unavailable`, so the figures stay and say how old they are.
 */
export interface PanelMeta {
  /** Re-ask the question. Offered on `unavailable` and `stale` panels. */
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
  /** A refetch is running over data already on screen. */
  refreshing?: boolean | undefined
  /**
   * The figures belong to a previous window, filter or granularity and are
   * held on screen until the new ones arrive. They are dimmed and marked busy
   * so nobody reads last window's total as this window's.
   */
  provisional?: boolean | undefined
  /** The last refresh failed and the figures are the previous good copy. */
  stale?: boolean | undefined
  /** When the figures were fetched, in epoch milliseconds. */
  updatedAt?: number | undefined
  /** Disclosure of what the figures are computed from, e.g. "Based on the latest 100 invoices." */
  basedOn?: string | undefined
}

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

export interface EventsPanel extends PanelMeta {
  status: PanelStatus
  points: EventPoint[]
  /** Events ingested across the window. */
  total: number | null
  /** What the server priced this usage at. `null` when it sent no subtotal. */
  revenue: MoneyValue | null
  /** Change in `total` against the window before this one. Omitted or `null` when there is no prior window to compare. */
  totalChangePercent?: number | null | undefined
  /** Change in `revenue` against the window before this one, in the same currency. Omitted or `null` when not comparable. */
  revenueChangePercent?: number | null | undefined
}

/** One customer's billed revenue, for the top-customers list. */
export interface RevenueCustomerRow {
  id: string
  name: string
  total: MoneyValue
}

/**
 * Invoiced revenue for the window: what was billed, from invoice line items:
 * in one currency. Amounts in other currencies are named, never added in.
 */
export interface RevenuePanel extends PanelMeta {
  status: PanelStatus
  total: MoneyValue | null
  fixed: MoneyValue | null
  usage: MoneyValue | null
  /** Change in `total` against the window before this one. `null` when not comparable. */
  changePercent?: number | null | undefined
  /**
   * Net revenue per bucket in `total`'s currency. Empty when the tenant has no
   * revenue analytics, in which case the headline stands alone.
   */
  points: { label: string; value: number; extra?: Record<string, number> }[]
  /** One line per currency on the revenue chart. */
  series?: { id: string; label: string }[] | undefined
  /** The customers billed most in the window, highest first. */
  topCustomers: RevenueCustomerRow[]
  /** Other currencies billed in the window, which the figures above leave out. */
  otherCurrencies: string[]
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

export interface SubscriptionsPanel extends PanelMeta {
  status: PanelStatus
  total: number
  /** Change against the window before this one. `null` when there is no prior window to compare. */
  changePercent: number | null
  /** The columns of the stack, oldest first. */
  days: SubscriptionDay[]
  /** Plans that appear in the window, busiest first. Drives both the columns and the legend. */
  plans: { name: string; count: number }[]
}

export interface InvoicesPanel extends PanelMeta {
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
export interface CustomersPanel extends PanelMeta {
  status: PanelStatus
  /** Customers created inside the window. `null` when it could not be counted. */
  newCount: number | null
  /**
   * `true` when the page could only see the newest customers and every one of
   * them fell inside the window: so `newCount` is a floor, not a total, and is
   * shown with a `+` rather than as an exact figure.
   */
  partial: boolean
  /** New customers per bucket, oldest first. */
  points: { label: string; customers: number }[]
  /** Change in `newCount` against the window before this one. Omitted or `null` when that window was not fully read. */
  changePercent?: number | null | undefined
}

export interface UsageRow {
  featureId: string
  name: string
  /** The feature's lookup key: shown under the name as `code.key`. */
  lookupKey: string
  /**
   * The metered quantity as a number.
   *
   * The meter compares features to each other, so it needs the figure and not
   * only its rendering: "428K calls" and "1.8M tokens" cannot be ranked as
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

/** The range option that opens the date picker instead of naming a fixed window. */
export const CUSTOM_RANGE_ID = 'custom'

/** A chosen span of whole days, both ends inclusive. */
export interface DayRange {
  from: Date
  to: Date
}

export interface DashboardHomeProps {
  rangeOptions: FilterOption[]
  range: string
  onRangeChange: (range: string) => void
  /**
   * The dates behind the `custom` range option. Drawn as a date-range picker
   * beside the range select while `custom` is chosen.
   */
  customRange?: { value: DayRange | null; onChange: (range: DayRange) => void } | undefined

  granularityOptions: FilterOption[]
  granularity: string
  onGranularityChange: (granularity: string) => void

  /** Words for the window, e.g. "last 7 days". Used in the panels' subtitles. */
  rangeLabel: string

  events: EventsPanel
  /**
   * Billed revenue. When given, the Revenue tab shows it (with a daily series
   * where one exists) and a breakdown row follows the chart; without it the
   * tab falls back to the usage subtotal on `events`.
   */
  revenue?: RevenuePanel | undefined
  customers: CustomersPanel
  subscriptions: SubscriptionsPanel
  invoices: InvoicesPanel
  /**
   * Usage by feature and API key health. Not rendered at the moment: both
   * panels are parked until quota-based metrics land (see `DashboardHome`):
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
 * Not "coming soon" and not a zero: the metric is named, and the reason it is
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

export interface Filter {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  icon?: ReactNode
}

export function FilterSelect({ filter }: { filter: Filter }) {
  return (
    <Select
      value={filter.value}
      // Base UI's `Select.Value` renders the raw value unless the root can
      // map it to a label: without this the filters read "7d", "daily",
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
 * The filter row: Overview on the left, granularity and the range on the right.
 *
 * The range still cuts every panel on the page: the metrics, the contracts
 * and the invoices: to the same window. Granularity only changes how the
 * usage series is bucketed.
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
    <FilterSelect
      filter={{
        label: 'Range',
        value: props.range,
        options: props.rangeOptions,
        onChange: props.onRangeChange,
        icon: <CalendarIcon aria-hidden className="size-3.5" />,
      }}
    />
  )
}

const shortDay = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * The custom range: a button naming the chosen days that opens a two-month
 * calendar. A range is only reported once both ends are picked, so a half-made
 * choice never refetches the page.
 */
function CustomRangePicker({
  value,
  onChange,
}: {
  value: DayRange | null
  onChange: (range: DayRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<
    { from?: Date | undefined; to?: Date | undefined } | undefined
  >(value ?? undefined)
  const today = new Date()
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(value ?? undefined)
      }}
    >
      <PopoverTrigger
        render={<Button type="button" variant="outline" aria-label="Custom date range" />}
      >
        <CalendarIcon aria-hidden className="size-3.5" />
        {value ? shortDay.formatRange(value.from, value.to) : 'Pick dates'}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          numberOfMonths={2}
          disabled={{ after: today }}
          defaultMonth={value?.from ?? new Date(today.getFullYear(), today.getMonth() - 1, 1)}
          selected={draft as never}
          onSelect={(next: { from?: Date | undefined; to?: Date | undefined } | undefined) => {
            setDraft(next)
            if (next?.from && next.to && next.from.getTime() !== next.to.getTime()) {
              onChange({ from: next.from, to: next.to })
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function ChartFilters(props: {
  granularityOptions: FilterOption[]
  granularity: string
  onGranularityChange: (value: string) => void
  /** The range picker, beside granularity at the right end of the row. */
  range: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-medium tracking-tight">Overview</h1>
      <div className="ml-auto flex items-center gap-2">
        <FilterSelect
          filter={{
            label: 'Granularity',
            value: props.granularity,
            options: props.granularityOptions,
            onChange: props.onGranularityChange,
          }}
        />
        {props.range}
      </div>
    </div>
  )
}

/* ---- 2. Key metrics ---------------------------------------------------- */

const METRIC_REVENUE = 'revenue'
const METRIC_CUSTOMERS = 'customers'
const METRIC_EVENTS = 'events'

/**
 * The shape behind the first-run message.
 *
 * It is not data and never becomes data: `BlurredEmpty` renders its children
 * `aria-hidden`, `inert` and blurred, and `MetricChart` hides its y-axis, so
 * this is a line with no scale, no axis and no tooltip: a texture that says
 * "a chart goes here". The tab headlines above it stay dashes, because those
 * *are* legible. It is only ever drawn once the API has answered "nothing":
 * while a panel is loading or has failed, the chart says that instead.
 */
const PLACEHOLDER_SHAPE = [46, 61, 54, 72, 65, 83, 74, 91, 86, 104, 97, 112].map((value) => ({
  label: '',
  value,
}))

/** A tab's `changePercent`, present only when a real prior window produced one. */
function changeOf(percent: number | null | undefined): { changePercent?: number } {
  return percent === null || percent === undefined ? {} : { changePercent: percent }
}

/** A panel's status as a tab's: an empty answer is still an answer, so it is `ready`. */
function tabStatus(status: PanelStatus): MetricTabStatus {
  return status === 'loading' ? 'loading' : status === 'unavailable' ? 'unavailable' : 'ready'
}

/**
 * One freshness reading across several panels: refreshing if any is, stale if
 * any is (with the oldest copy's age), and a retry that targets a stale one.
 * Computed here rather than read off a query so the component stays
 * presentational.
 */
function freshnessOf(...panels: PanelMeta[]) {
  const stamps = panels.flatMap((panel) => (panel.updatedAt === undefined ? [] : [panel.updatedAt]))
  const staleOne = panels.find((panel) => panel.stale && panel.onRetry)
  return {
    updatedAt: stamps.length > 0 ? Math.min(...stamps) : undefined,
    refreshing: panels.some((panel) => panel.refreshing),
    provisional: panels.some((panel) => panel.provisional),
    stale: panels.some((panel) => panel.stale),
    retrying: panels.some((panel) => panel.isRetrying),
    onRetry: staleOne?.onRetry,
  }
}

/** A way out of an empty window: widen the range. */
interface Exit {
  label: string
  run: () => void
}

function MetricsSection({
  events,
  revenue,
  customers,
  filters,
  onQuickstart,
  widen,
}: {
  events: EventsPanel
  revenue?: RevenuePanel | undefined
  customers: CustomersPanel
  /** The chart's granularity and range, drawn above it. */
  filters: ReactNode
  onQuickstart: () => void
  /** Widens the range, or `null` when it is already the widest on offer. */
  widen: Exit | null
}) {
  // Which metric you are looking at is view state, not data, so it lives here
  // rather than in the props. `MetricChart` holds none of its own. Revenue is
  // what the overview is opened for, so it is the tab you land on.
  const [metric, setMetric] = useState(METRIC_REVENUE)

  const eventsReady = events.status === 'ready'
  const customersReady = customers.status === 'ready'
  // The first-run invitation is for an account whose sources *both* answered
  // "nothing". A source that is still loading or failed is not empty, and
  // saying "no events yet" over it would be a claim nobody has checked.
  const nothingYet = events.status === 'empty' && customers.status === 'empty'
  const revenueKnown = eventsReady && events.revenue !== null

  /**
   * The tab strip is the stat strip, in the order the overview is read:
   * Revenue, Customers, then Usage ingestion.
   *
   * Each tab carries its own status, because they come from different
   * requests: Revenue and Usage ingestion from events, Customers from the
   * customer list. A tab whose source is loading shows a placeholder bar and a
   * skeleton, one that failed says so with a retry, and neither ever shows a
   * dash or a zero. The dash is kept for a figure that is genuinely empty.
   *
   * Revenue has no series to plot: the usage API prices a window as a whole
   * rather than per bucket, and `emptyMessage` says so.
   */
  const revenueTab: MetricTab | null = revenue
    ? {
        id: METRIC_REVENUE,
        label: 'Revenue',
        status: tabStatus(revenue.status),
        onRetry: revenue.onRetry,
        value:
          revenue.status === 'ready' && revenue.total !== null ? (
            <Money value={revenue.total} />
          ) : (
            NOTHING
          ),
        ...changeOf(revenue.status === 'ready' ? revenue.changePercent : null),
        points: revenue.status === 'ready' ? revenue.points : [],
        ...(revenue.series?.length
          ? {
              series: revenue.series.map((line) => ({
                ...line,
                format: currencyFormat(line.id),
              })),
            }
          : {}),
        ...(revenue.total ? { format: currencyFormat(revenue.total.currency) } : {}),
        emptyMessage:
          revenue.status === 'empty'
            ? 'Nothing was billed in this period.'
            : 'No revenue to plot for this period.',
      }
    : null

  const tabs: MetricTab[] = [
    revenueTab ?? {
      id: METRIC_REVENUE,
      label: 'Revenue',
      status: tabStatus(events.status),
      onRetry: events.onRetry,
      // The server's own subtotal, or nothing. `Money` has no `add`, and
      // summing prices across currencies in the browser would be the wrong
      // answer rendered confidently.
      value: revenueKnown && events.revenue !== null ? <Money value={events.revenue} /> : NOTHING,
      ...changeOf(revenueKnown ? events.revenueChangePercent : null),
      points: [],
      // Never "No revenue in this period" beside a headline that has one.
      emptyMessage: 'No revenue to plot for this period.',
    },
    {
      id: METRIC_CUSTOMERS,
      label: 'Customers',
      status: tabStatus(customers.status),
      onRetry: customers.onRetry,
      value:
        customersReady && customers.newCount !== null
          ? `${whole.format(customers.newCount)}${customers.partial ? '+' : ''}`
          : NOTHING,
      ...changeOf(customersReady ? customers.changePercent : null),
      points: customersReady
        ? customers.points.map((point) => ({ label: point.label, value: point.customers }))
        : [],
      emptyMessage: 'Active customers in this period. This figure has no daily series.',
    },
    {
      id: METRIC_EVENTS,
      label: 'Usage ingestion',
      status: tabStatus(events.status),
      onRetry: events.onRetry,
      value: eventsReady && events.total !== null ? compact.format(events.total) : NOTHING,
      ...changeOf(eventsReady && events.total !== null ? events.totalChangePercent : null),
      points: eventsReady
        ? events.points.map((point) => ({ label: point.label, value: point.events }))
        : [],
      emptyMessage: EMPTY_CATALOGUE['usage-period'].title,
    },
  ]

  const placeholder: MetricTab[] = tabs.map((tab) =>
    tab.id === METRIC_REVENUE ? { ...tab, points: PLACEHOLDER_SHAPE } : tab,
  )

  const fresh = revenue ? freshnessOf(events, customers, revenue) : freshnessOf(events, customers)

  // Period-empty ("this window has nothing; earlier data is unchanged") is a
  // different message from first-run ("nothing has ever arrived"). A narrower
  // range means we cannot claim the latter.
  const periodEmpty = widen !== null
  const firstRunCopy = EMPTY_CATALOGUE.events
  const periodCopy = EMPTY_CATALOGUE['usage-period']

  return (
    <section aria-label="Key metrics" className="flex min-w-0 flex-col gap-3">
      <h2 className="sr-only">Key metrics</h2>
      {filters}
      {nothingYet ? (
        /*
         * The invitation sits over a blurred chart rather than replacing it, so
         * the shape of what will appear is visible while it is still empty:
         * the design's own choice, and it keeps the panel from collapsing and
         * shifting everything below it the moment data arrives.
         */
        <BlurredEmpty
          scene="home"
          title={periodEmpty ? periodCopy.title : firstRunCopy.title}
          description={periodEmpty ? periodCopy.description : firstRunCopy.description}
          action={
            widen
              ? { label: widen.label, onClick: widen.run }
              : { label: firstRunCopy.primaryLabel ?? 'Send a test event', onClick: onQuickstart }
          }
        >
          <MetricChart
            tabs={placeholder}
            activeTab={METRIC_REVENUE}
            onTabChange={() => {}}
            height={240}
          />
        </BlurredEmpty>
      ) : (
        <DataRegion state={{ refreshing: fresh.refreshing, provisional: fresh.provisional }}>
          <MetricChart tabs={tabs} activeTab={metric} onTabChange={setMetric} height={240} />
        </DataRegion>
      )}

      {fresh.stale ? (
        <DataFreshness
          updatedAt={fresh.updatedAt}
          stale
          refreshing={fresh.retrying}
          {...(fresh.onRetry ? { onRefresh: fresh.onRetry } : {})}
        />
      ) : null}
    </section>
  )
}

/* ---- Revenue breakdown ------------------------------------------------ */

/** Compact currency figures for a chart's tooltip and axis: "$1.2K". */
function currencyFormat(currency: string): (value: number) => string {
  const format = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  return (value) => format.format(value)
}

/**
 * Where the window's revenue came from: fixed fees against usage, and the
 * customers it was billed to. Every figure is the server's decimal; the bars
 * only compare the two to each other.
 */
function RevenueBreakdown({
  revenue,
}: {
  revenue: RevenuePanel
  /** Wired to "View revenue" on Top customers. That panel is commented out. */
  onViewRevenue: () => void
}) {
  const ready = revenue.status === 'ready'
  const mix: SegmentMeterRow[] =
    ready && revenue.fixed && revenue.usage
      ? [
          {
            id: 'fixed',
            label: 'Fixed',
            caption: 'Recurring fees and seats',
            value: Number(revenue.fixed.amount),
            display: formatMoney(revenue.fixed),
          },
          {
            id: 'usage',
            label: 'Usage',
            caption: 'Metered charges',
            value: Number(revenue.usage.amount),
            display: formatMoney(revenue.usage),
          },
        ]
      : []
  // Top customers by revenue is parked. Restore the panel below and this list.
  // const top: SegmentMeterRow[] = ready
  //   ? revenue.topCustomers.map((row) => ({
  //       id: row.id || row.name,
  //       label: row.name,
  //       value: Number(row.total.amount),
  //       display: formatMoney(row.total),
  //     }))
  //   : []

  const body = (rows: SegmentMeterRow[], label: string, empty: string) =>
    revenue.status === 'loading' ? (
      <ChartSkeleton height={120} />
    ) : revenue.status === 'unavailable' ? (
      <Unavailable what="Revenue could not be loaded." />
    ) : (
      <SegmentMeter rows={rows} label={label} emptyMessage={empty} />
    )

  // Invoiced revenue carries no fixed/usage split. With top customers parked,
  // that case has nothing to draw here.
  const hasMix = revenue.fixed !== null && revenue.usage !== null
  if (!hasMix) return null

  return (
    <div className="grid grid-cols-1 gap-5">
      <Panel title="Revenue mix">
        <DataRegion
          state={{
            refreshing: Boolean(revenue.refreshing),
            provisional: Boolean(revenue.provisional),
          }}
        >
          <div className="flex flex-1 flex-col justify-center p-6">
            {body(mix, 'Revenue by type', 'Nothing was billed in this period.')}
          </div>
        </DataRegion>
      </Panel>
      {/*
       * Top customers by revenue is parked. The list (`top`) and the
       * "View revenue" action (`onViewRevenue`) come back with it.
       *
       * <Panel
       *   title="Top customers by revenue"
       *   action={
       *     <Button variant="outline" size="sm" onClick={onViewRevenue}>
       *       View revenue
       *     </Button>
       *   }
       * >
       *   <DataRegion
       *     state={{
       *       refreshing: Boolean(revenue.refreshing),
       *       provisional: Boolean(revenue.provisional),
       *     }}
       *   >
       *     <div className="flex flex-1 flex-col justify-center p-6">
       *       {body(top, 'Top customers by revenue', 'No customer was billed in this period.')}
       *     </div>
       *   </DataRegion>
       * </Panel>
       */}
    </div>
  )
}

/* ---- 3. Recent subscriptions -------------------------------------------- */

function SubscriptionsCard({
  subscriptions,
  rangeLabel,
  onViewAll,
  widen,
}: {
  subscriptions: SubscriptionsPanel
  rangeLabel: string
  onViewAll: () => void
  widen: Exit | null
}) {
  const { status, plans, days, total, changePercent } = subscriptions
  const ready = status === 'ready'
  const loading = status === 'loading'
  const failed = status === 'unavailable'

  // Plans are categories, not states, so they take the categorical slots in
  // order: `PillColumns` hands those out itself when no tone is given.
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
      <DataRegion
        state={{
          refreshing: Boolean(subscriptions.refreshing),
          provisional: Boolean(subscriptions.provisional),
        }}
      >
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-baseline gap-2">
            {/* A count is only printed when the API said it. Loading is a bar,
                a failure says so, and an empty window is a dash rather than a
                "0 new contracts" that would read as a measurement. */}
            <span className="text-4xl font-medium tabular-nums">
              {ready ? (
                total
              ) : loading ? (
                <ValuePlaceholder width={4} label="Loading new contracts" />
              ) : failed ? (
                <span className="text-muted-foreground text-base font-normal">Unavailable</span>
              ) : (
                <span className="text-muted-foreground">{NOTHING}</span>
              )}
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
                {new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
                  changePercent,
                )}
                %{' vs prior period'}
              </span>
            ) : null}
          </div>

          {ready ? (
            <>
              <PillColumns
                columns={columns}
                series={series}
                label={`New contracts by plan, ${rangeLabel}`}
              />
              {subscriptions.stale ? (
                <DataFreshness
                  updatedAt={subscriptions.updatedAt}
                  stale
                  refreshing={Boolean(subscriptions.isRetrying)}
                  {...(subscriptions.onRetry ? { onRefresh: subscriptions.onRetry } : {})}
                />
              ) : null}
            </>
          ) : loading ? (
            // Bones for where the stack will go: no columns, no pills, no numbers.
            <ChartSkeleton height={128} lines={3} label="Loading contracts" />
          ) : failed ? (
            <div
              role="alert"
              className="border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center text-sm"
            >
              <span>Contracts could not be loaded.</span>
              {subscriptions.onRetry ? (
                <RetryAction
                  onRetry={subscriptions.onRetry}
                  {...(subscriptions.isRetrying !== undefined
                    ? { isRetrying: subscriptions.isRetrying }
                    : {})}
                />
              ) : null}
            </div>
          ) : (
            <div className="border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center text-sm">
              <span>No contracts were created in this period.</span>
              {widen ? (
                <Button variant="outline" size="sm" onClick={widen.run}>
                  {widen.label}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </DataRegion>
    </Panel>
  )
}

/* ---- 4. Invoice payment status ------------------------------------------ */

/**
 * The half-donut over real invoice counts.
 *
 * The three slices are the three states the domain actually models: paid, open
 * and overdue. The design labelled them paid/pending/failed, which are wire
 * `payment_status` values that `deriveInvoiceStatus` collapses; using the
 * domain's own vocabulary is what keeps this panel agreeing with the invoice
 * list it links to.
 *
 * These are states, so they take the status tones rather than the categorical
 * ones. Overdue is `critical` because overdue is bad, not because it was third
 * in the rotation.
 *
 * The ring only prints numbers it was told. Loading, failed and empty windows
 * go through `HalfDonut`'s `status`, so none of them is drawn as "0 invoices".
 */
function InvoicesCard({
  invoices,
  onViewInvoices,
  widen,
}: {
  invoices: InvoicesPanel
  onViewInvoices: () => void
  widen: Exit | null
}) {
  const ready = invoices.status === 'ready'
  const slices: DonutSlice[] = [
    { id: 'paid', label: 'Paid', value: ready ? invoices.paid : 0, tone: 'good' },
    { id: 'open', label: 'Open', value: ready ? invoices.open : 0, tone: 'warning' },
    { id: 'overdue', label: 'Overdue', value: ready ? invoices.overdue : 0, tone: 'critical' },
  ]
  const donutStatus =
    invoices.status === 'loading'
      ? 'loading'
      : invoices.status === 'unavailable'
        ? 'error'
        : invoices.status === 'empty'
          ? 'empty'
          : 'ready'

  return (
    <Panel
      title="Invoice payment status"
      action={
        <Button variant="outline" size="sm" onClick={onViewInvoices}>
          View invoices
        </Button>
      }
    >
      <DataRegion
        state={{
          refreshing: Boolean(invoices.refreshing),
          provisional: Boolean(invoices.provisional),
        }}
      >
        <div className="flex flex-1 flex-col justify-center gap-4 p-6">
          <HalfDonut
            slices={slices}
            centerLabel="Invoices"
            centerValue={ready ? invoices.total : 0}
            label="Invoice payment status"
            status={donutStatus}
            {...(invoices.onRetry ? { onRetry: invoices.onRetry } : {})}
            {...(invoices.isRetrying !== undefined ? { isRetrying: invoices.isRetrying } : {})}
          />
          {invoices.status === 'unavailable' ? (
            <Unavailable what="Invoices could not be loaded." className="text-center" />
          ) : null}
          {invoices.status === 'empty' ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground text-xs">No invoices in this period.</p>
              {widen ? (
                <Button variant="outline" size="sm" onClick={widen.run}>
                  {widen.label}
                </Button>
              ) : null}
            </div>
          ) : null}
          {ready && invoices.stale ? (
            <div className="flex justify-center">
              <DataFreshness
                updatedAt={invoices.updatedAt}
                stale
                refreshing={Boolean(invoices.isRetrying)}
                {...(invoices.onRetry ? { onRefresh: invoices.onRetry } : {})}
              />
            </div>
          ) : null}
        </div>
      </DataRegion>
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
 * request metrics at all, so it shows a ratio that *is* real: how many of the
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
         * the API or the SDK: only per-event debugging: so they are shown as
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
  customRange,
  granularityOptions,
  granularity,
  onGranularityChange,
  rangeLabel,
  events,
  revenue,
  customers,
  subscriptions,
  invoices,
  onNavigate,
}: DashboardHomeProps) {
  const go = (path: string) => onNavigate?.(path)

  // Ways out of an empty window. The range options run narrow to wide, so the
  // last is the widest; if it is already chosen there is nowhere wider to go.
  const widest = rangeOptions.filter((option) => option.id !== CUSTOM_RANGE_ID).at(-1)
  const widen: Exit | null =
    widest !== undefined && widest.id !== range
      ? { label: `Show ${widest.label.toLowerCase()}`, run: () => onRangeChange(widest.id) }
      : null

  return (
    <div className="flex flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <MetricsSection
        events={events}
        {...(revenue ? { revenue } : {})}
        customers={customers}
        filters={
          <ChartFilters
            granularityOptions={granularityOptions}
            granularity={granularity}
            onGranularityChange={onGranularityChange}
            range={
              <>
                <RangeFilter
                  rangeOptions={rangeOptions}
                  range={range}
                  onRangeChange={onRangeChange}
                />
                {range === CUSTOM_RANGE_ID && customRange ? (
                  <CustomRangePicker value={customRange.value} onChange={customRange.onChange} />
                ) : null}
              </>
            }
          />
        }
        onQuickstart={() => go('/features')}
        widen={widen}
      />

      {revenue ? <RevenueBreakdown revenue={revenue} onViewRevenue={() => go('/revenue')} /> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SubscriptionsCard
          subscriptions={subscriptions}
          rangeLabel={rangeLabel}
          onViewAll={() => go('/subscriptions')}
          widen={widen}
        />
        <InvoicesCard invoices={invoices} onViewInvoices={() => go('/invoices')} widen={widen} />
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
