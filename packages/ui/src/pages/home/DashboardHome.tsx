import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRightIcon, InfoIcon, KeyRoundIcon, SlidersHorizontalIcon } from 'lucide-react'
import type { Money as MoneyValue } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Separator } from '@ui/components/primitives/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { EmptyState } from '@ui/compositions/EmptyState'
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
import { SegmentMeter } from '../shared/SegmentMeter'
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
 * ReUI block adapted in place: `MetricChart` for the event series and the stat
 * strip that switches it, `PillColumns` for the per-day subscription stack,
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
 */
export const DashboardHomeProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/MetricChart',
    'pages/shared/BlurredEmpty',
    'pages/shared/PillColumns',
    'pages/shared/HalfDonut',
    'pages/shared/SegmentMeter',
    'pages/shared/ArcGauge',
    'ui/select',
    'compositions/EmptyState',
  ],
  note: 'Billing overview: event series, revenue, subscriptions, invoice payment status, metered usage and API keys, drawn with the shared chart library. Every figure is API-sourced or explicitly unavailable.',
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
  subscriptions: SubscriptionsPanel
  invoices: InvoicesPanel
  usage: UsagePanel
  api: ApiPanel

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
 * A panel of the overview.
 *
 * Card is the project's surface (`provenance`, `SURFACE`), so every panel is one
 * — including the ones whose chart draws its own card. The charts in the shared
 * library are card-shaped so they can stand alone on a page; here they are
 * panel *contents*, and `CHART_IN_PANEL` is what gives that chrome back.
 */
function Panel({
  title,
  description,
  action,
  info,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** An explanation of the panel, behind the info icon the design puts beside the title. */
  info?: string
  children: ReactNode
  className?: string
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section
      aria-labelledby={id}
      className={cn('bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-5', className)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h2 id={id} className="text-sm font-medium">
              {title}
            </h2>
            {info ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground size-5"
                      aria-label={`About ${title}`}
                    />
                  }
                >
                  <InfoIcon aria-hidden className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{info}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

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

function FilterRow({
  rangeOptions,
  range,
  onRangeChange,
  granularityOptions,
  granularity,
  onGranularityChange,
  customerOptions,
  customer,
  onCustomerChange,
  onConfigure,
}: {
  rangeOptions: FilterOption[]
  range: string
  onRangeChange: (value: string) => void
  granularityOptions: FilterOption[]
  granularity: string
  onGranularityChange: (value: string) => void
  customerOptions: FilterOption[]
  customer: string
  onCustomerChange: (value: string) => void
  onConfigure: () => void
}) {
  const filters: {
    label: string
    value: string
    options: FilterOption[]
    onChange: (value: string) => void
    width: string
  }[] = [
    {
      label: 'Range',
      value: range,
      options: rangeOptions,
      onChange: onRangeChange,
      width: 'w-[8.5rem]',
    },
    {
      label: 'Granularity',
      value: granularity,
      options: granularityOptions,
      onChange: onGranularityChange,
      width: 'w-[7rem]',
    },
    {
      label: 'Customer',
      value: customer,
      options: customerOptions,
      onChange: onCustomerChange,
      width: 'w-[11rem]',
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Select
          key={filter.label}
          value={filter.value}
          // Base UI's `Select.Value` renders the raw value unless the root can
          // map it to a label — without this the filters read "7d", "daily",
          // "all". `chart-16` passes `items` for the same reason.
          items={filter.options.map((option) => ({ value: option.id, label: option.label }))}
          // Base UI's Select can clear to `null`; these three always have a
          // selection, so a clear is simply ignored rather than widening every
          // handler in the page to accept an absent filter.
          onValueChange={(value) => {
            if (value !== null) filter.onChange(value)
          }}
        >
          <SelectTrigger aria-label={filter.label} className={cn('h-8', filter.width)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {filter.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/*
       * The design also drew an "+ Add filter" control. It is left out rather
       * than drawn dead: this console already learned from a global search box
       * that swallowed what you typed (see `ShellSearch`) that a control which
       * does nothing is worse than a control that is not there. "Configure"
       * stays because it has somewhere real to go.
       */}
      <Button variant="outline" size="sm" className="ms-auto h-8" onClick={onConfigure}>
        <SlidersHorizontalIcon aria-hidden />
        Configure
      </Button>
    </div>
  )
}

/* ---- 2. Events monitoring ----------------------------------------------- */

/**
 * The chart library's cards, given up so they can be panel contents.
 *
 * `MetricChart` draws `bg-card rounded-xl border` so it can stand alone. Inside
 * a `Panel` that would be a card in a card — two borders, two backgrounds. This
 * strips all of it except the rule under the tab strip, and bleeds the strip to
 * the panel's edges so it reads as one divided header rather than an inset box.
 */
const CHART_IN_PANEL = '-mx-5 rounded-none border-x-0 border-t-0 bg-transparent'

const METRIC_EVENTS = 'events'
const METRIC_REVENUE = 'revenue'
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

function EventsSection({
  events,
  rangeLabel,
  onQuickstart,
}: {
  events: EventsPanel
  rangeLabel: string
  onQuickstart: () => void
}) {
  // Which metric you are looking at is view state, not data, so it lives here
  // rather than in the props. `MetricChart` holds none of its own.
  const [metric, setMetric] = useState(METRIC_EVENTS)

  const ready = events.status === 'ready'

  /**
   * The tab strip is the stat strip.
   *
   * All three metrics the design asked for are here, and two of them have no
   * series to plot: the usage API prices a window as a whole rather than per
   * bucket, and processing lag is not measured anywhere in the stack. Both keep
   * their tab — dropping them would make "not plotted" and "not a thing we
   * track" look identical — and `caption` below carries the reason.
   */
  const tabs: MetricTab[] = [
    {
      id: METRIC_EVENTS,
      label: 'Events ingested',
      value: ready && events.total !== null ? compact.format(events.total) : NOTHING,
      points: ready
        ? events.points.map((point) => ({ label: point.label, value: point.events }))
        : [],
    },
    {
      id: METRIC_REVENUE,
      label: 'Revenue',
      // The server's own subtotal, or nothing. `Money` has no `add`, and
      // summing prices across currencies in the browser would be the wrong
      // answer rendered confidently.
      value: ready && events.revenue !== null ? <Money value={events.revenue} /> : NOTHING,
      points: [],
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
    metric === METRIC_EVENTS
      ? `Usage events received, ${rangeLabel}.`
      : metric === METRIC_REVENUE
        ? 'Revenue is priced for the window as a whole; the usage API returns no per-bucket figure to plot.'
        : undefined

  const placeholder: MetricTab[] = tabs.map((tab) =>
    tab.id === METRIC_EVENTS ? { ...tab, points: PLACEHOLDER_SHAPE } : tab,
  )

  const chart = (
    <MetricChart
      tabs={tabs}
      activeTab={metric}
      onTabChange={setMetric}
      caption={caption}
      height={240}
      className={CHART_IN_PANEL}
    />
  )

  return (
    <Panel
      title="Events monitoring"
      description={`Ingestion, revenue and processing lag, ${rangeLabel}.`}
      info="Every metered event Flexprice accepted in this window, bucketed by the granularity above."
    >
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
                : 'Send your first usage event and this chart shows ingestion, revenue and processing lag as it happens.'
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
            activeTab={METRIC_EVENTS}
            onTabChange={() => {}}
            height={240}
            className={CHART_IN_PANEL}
          />
        </BlurredEmpty>
      )}

      {ready && events.revenue === null ? (
        <Unavailable what="The usage API returned no priced subtotal for this window." />
      ) : null}
      <Unavailable what="Flexprice does not expose an ingestion-lag metric." />
    </Panel>
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
      title="Recent subscriptions"
      description={`New in the ${rangeLabel}.`}
      info="Subscriptions whose start date falls inside this window, counted by the plan they were created on."
      action={
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all
        </Button>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {ready ? total : 0}
        </span>
        <span className="text-muted-foreground text-sm">new subscriptions</span>
        {ready && changePercent !== null ? (
          <span
            className={cn(
              'text-sm font-medium tabular-nums',
              changePercent >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {changePercent >= 0 ? '+' : ''}
            {new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(changePercent)}%
            {' vs prior period'}
          </span>
        ) : null}
      </div>

      {ready ? (
        <PillColumns
          columns={columns}
          series={series}
          label={`New subscriptions by plan, ${rangeLabel}`}
        />
      ) : (
        <>
          {/* The same matrix with nothing lit — which is what the chart draws
              for an all-zero window anyway, so the shape never jumps as the
              data arrives. */}
          <div className="flex w-full items-end gap-2" aria-hidden>
            {Array.from({ length: 7 }, (_, column) => (
              <div key={column} className="flex min-w-0 flex-1 flex-col justify-end">
                {Array.from({ length: 7 }, (_, row) => (
                  <span key={row} className="bg-muted my-0.5 h-3 rounded" />
                ))}
              </div>
            ))}
          </div>
          {status === 'unavailable' ? (
            <Unavailable what="Subscriptions could not be loaded." />
          ) : (
            <p className="text-muted-foreground text-xs">
              Subscriptions created in this period appear here, by plan.
            </p>
          )}
        </>
      )}
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
  rangeLabel,
  onViewInvoices,
}: {
  invoices: InvoicesPanel
  rangeLabel: string
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
      description={`Finalized in the ${rangeLabel}.`}
      info="Invoices issued inside this window, grouped by whether they are settled, still open, or past their due date."
      action={
        <Button variant="ghost" size="sm" onClick={onViewInvoices}>
          View invoices
        </Button>
      }
    >
      {invoices.status === 'unavailable' ? (
        // Zeroes would be a claim. A window that could not be read gets the
        // reason instead of a ring and three noughts.
        <Unavailable what="Invoices could not be loaded." />
      ) : (
        <HalfDonut
          slices={slices}
          centerLabel="Invoices"
          centerValue={ready ? invoices.total : 0}
          label="Invoice payment status"
        />
      )}
    </Panel>
  )
}

/* ---- 5. Usage by feature ------------------------------------------------ */

function UsageCard({
  usage,
  rangeLabel,
  onViewFeatures,
  className,
}: {
  usage: UsagePanel
  rangeLabel: string
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
      description={`Top metered features, ${rangeLabel}.`}
      info="Metered quantity per feature over this window, with the change against the window before it."
      action={
        <Button variant="ghost" size="sm" onClick={onViewFeatures}>
          All features
        </Button>
      }
      {...(className !== undefined ? { className } : {})}
    >
      {usage.status === 'unavailable' ? (
        <Unavailable what="Usage analytics could not be loaded." />
      ) : (
        <SegmentMeter
          rows={usage.status === 'ready' ? rows : []}
          label="Usage by feature"
          emptyMessage="No usage recorded yet"
        />
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
function ApiCard({
  api,
  rangeLabel,
  onApiKeys,
}: {
  api: ApiPanel
  rangeLabel: string
  onApiKeys: () => void
}) {
  const ready = api.status === 'ready' && api.totalKeys > 0
  const healthy = api.activeKeys === api.totalKeys

  return (
    <Panel
      title="API"
      description={rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}
      info="Key health for this environment. Request volume, latency and error counts are not exposed by the Flexprice API."
      action={
        <Button variant="ghost" size="sm" onClick={onApiKeys}>
          API keys
          <ArrowUpRightIcon aria-hidden />
        </Button>
      }
    >
      {ready ? (
        <ArcGauge
          value={api.activeKeys}
          max={api.totalKeys}
          display={healthy ? 'Healthy' : 'Attention'}
          caption={`${whole.format(api.activeKeys)} of ${whole.format(api.totalKeys)} keys active`}
          tone={healthy ? 'good' : 'warning'}
          label="API keys active"
        />
      ) : api.status === 'unavailable' ? (
        <Unavailable what="API keys could not be loaded." />
      ) : (
        <EmptyState
          size="inline"
          icon={<KeyRoundIcon aria-hidden />}
          title="Waiting for first request"
          description="Create an API key to start sending events."
          action={<Button onClick={onApiKeys}>Create API key</Button>}
        />
      )}

      <Separator />

      {/*
       * Requests, p95 and errors are the three numbers the design asked for and
       * the three this console cannot get. There is no observability surface in
       * the API or the SDK — only per-event debugging — so they are shown as
       * absent with the reason, in the same shape they would take if they
       * arrived.
       */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Requests', value: NOTHING },
          { label: 'p95 latency', value: NOTHING },
          { label: 'Errors', value: NOTHING },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs">{stat.label}</span>
            <span className="text-base font-medium tabular-nums">{stat.value}</span>
          </div>
        ))}
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
  subscriptions,
  invoices,
  usage,
  api,
  onNavigate,
}: DashboardHomeProps) {
  const go = (path: string) => onNavigate?.(path)

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-5 p-6">
      {/* The visible title lives in the shell's breadcrumb; the outline still needs one. */}
      <h1 className="sr-only">Overview</h1>

      <FilterRow
        rangeOptions={rangeOptions}
        range={range}
        onRangeChange={onRangeChange}
        granularityOptions={granularityOptions}
        granularity={granularity}
        onGranularityChange={onGranularityChange}
        customerOptions={customerOptions}
        customer={customer}
        onCustomerChange={onCustomerChange}
        onConfigure={() => go('/settings')}
      />

      <EventsSection events={events} rangeLabel={rangeLabel} onQuickstart={() => go('/features')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SubscriptionsCard
          subscriptions={subscriptions}
          rangeLabel={rangeLabel}
          onViewAll={() => go('/subscriptions')}
        />
        <InvoicesCard
          invoices={invoices}
          rangeLabel={rangeLabel}
          onViewInvoices={() => go('/invoices')}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <UsageCard
          usage={usage}
          rangeLabel={rangeLabel}
          onViewFeatures={() => go('/features')}
          className="lg:col-span-2"
        />
        <ApiCard api={api} rangeLabel={rangeLabel} onApiKeys={() => go('/settings')} />
      </div>
    </div>
  )
}
