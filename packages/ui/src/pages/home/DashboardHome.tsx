import { useState } from 'react'
import { CalendarIcon, Settings2Icon } from 'lucide-react'
import type { Money as MoneyValue } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { BlurredEmpty, MetricChart } from '../shared/charts'
import type { MetricTab } from '../shared/charts'
import { Money } from '../shared/Money'

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
 * Three primary metrics and nothing under them: Revenue, Customers and Usage
 * ingestion, each a tab on one `MetricChart` that is also the stat strip.
 * `BlurredEmpty` carries the first run. What this file keeps is the *wiring* —
 * which panel is ready, empty or unavailable, and which numbers are allowed on
 * screen at all. The contracts, invoice, usage-by-feature and API cards that used
 * to follow were dropped on purpose; the per-feature usage meter is kept below,
 * commented out, for when quota metrics return.
 */
export const DashboardHomeProvenance = provenance({
  source: 'composition',
  composes: ['ui/select'],
  note: 'Billing overview: revenue, customers and usage ingestion on one metric chart, drawn with the shared chart library. Every figure is API-sourced or explicitly unavailable. Lineage: pages/shared/MetricChart, pages/shared/BlurredEmpty.',
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

export interface CustomersPanel {
  status: PanelStatus
  /** Customers on the account. `null` when the API did not say. */
  total: number | null
  /** New customers per bucket across the window, oldest first. */
  points: { label: string; customers: number }[]
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

  /** Where a link on the overview leads. No-op by default, so the surface renders in isolation. */
  onNavigate?: (path: string) => void
}

/* ---- Formatting --------------------------------------------------------- */

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

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
  }[] = [
    {
      label: 'Range',
      value: range,
      options: rangeOptions,
      onChange: onRangeChange,
    },
    {
      label: 'Granularity',
      value: granularity,
      options: granularityOptions,
      onChange: onGranularityChange,
    },
    {
      label: 'Customer',
      value: customer,
      options: customerOptions,
      onChange: onCustomerChange,
    },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
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
            <SelectTrigger aria-label={filter.label}>
              {filter.label === 'Range' ? <CalendarIcon aria-hidden className="size-3.5" /> : null}
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
        ))}
      </div>

      {/*
       * The design also drew an "+ Add filter" control. It is left out rather
       * than drawn dead: this console already learned from a global search box
       * that swallowed what you typed (see `ShellSearch`) that a control which
       * does nothing is worse than a control that is not there. "Configure"
       * stays because it has somewhere real to go.
       */}
      <Button variant="outline" size="sm" className="h-8 px-3" onClick={onConfigure}>
        <Settings2Icon aria-hidden />
        Configure
      </Button>
    </div>
  )
}

/* ---- 2. Overview metrics ------------------------------------------------ */

const METRIC_EVENTS = 'events'
const METRIC_REVENUE = 'revenue'
const METRIC_CUSTOMERS = 'customers'

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
  customers,
  rangeLabel,
  onQuickstart,
}: {
  events: EventsPanel
  customers: CustomersPanel
  rangeLabel: string
  onQuickstart: () => void
}) {
  // Which metric you are looking at is view state, not data, so it lives here
  // rather than in the props. `MetricChart` holds none of its own.
  const [metric, setMetric] = useState(METRIC_EVENTS)

  const eventsReady = events.status === 'ready'
  const customersReady = customers.status === 'ready'
  const ready = eventsReady || customersReady

  /**
   * The tab strip is the stat strip, in the order the overview is read:
   * Revenue, Customers, Usage ingestion.
   *
   * Revenue has no series to plot — the usage API prices a window as a whole
   * rather than per bucket — but it keeps its tab; the figure is the answer and
   * `caption` below says why there is no line.
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
      value: customersReady && customers.total !== null ? compact.format(customers.total) : NOTHING,
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
  ]

  const caption =
    metric === METRIC_EVENTS
      ? `Usage events received, ${rangeLabel}.`
      : metric === METRIC_CUSTOMERS
        ? `New customers, ${rangeLabel}.`
        : 'Revenue is priced for the window as a whole; the usage API returns no per-bucket figure to plot.'

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
    />
  )

  return (
    <section aria-label="Overview metrics" className="flex min-w-0 flex-col gap-3">
      <h2 className="sr-only">Overview metrics</h2>
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
                ? 'Loading overview'
                : 'No events yet'
          }
          description={
            events.status === 'unavailable'
              ? 'Flexprice could not load events for this window. Try again in a moment.'
              : events.status === 'loading'
                ? 'Fetching usage analytics for this window.'
                : 'Send your first usage event and this chart shows revenue, customers and ingestion as it happens.'
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
          />
        </BlurredEmpty>
      )}

      {eventsReady && events.revenue === null ? (
        <Unavailable what="The usage API returned no priced subtotal for this window." />
      ) : null}
    </section>
  )
}

/*
 * Quota metrics — usage by feature, kept out of the overview for now.
 *
 * Not rendered: the overview is Revenue, Customers and Usage ingestion only. The
 * card is left here, commented, so it can return unchanged once quota metrics
 * have a home. To restore it, bring back `Panel` (compositions/Section),
 * `SegmentMeter`/`MeterTrack` (pages/shared/SegmentMeter), a `usage: UsagePanel`
 * prop (status + rows of featureId, name, lookupKey, quantity, value,
 * changePercent) and the `toUsagePanel` shaping in the console's HomePage.
 *
 * function UsageCard({ usage, onViewFeatures, className }) {
 *   const rows: SegmentMeterRow[] = usage.rows.map((row) => ({
 *     id: row.featureId,
 *     label: row.name,
 *     caption: row.lookupKey,
 *     value: row.quantity,
 *     display: row.value,
 *     changePercent: row.changePercent ?? undefined,
 *   }))
 *   return (
 *     <Panel title="Usage by feature" action={<Button ...>All features</Button>}>
 *       {usage.status === 'ready' && rows.length > 0 ? (
 *         <SegmentMeter rows={rows} label="Usage by feature" className="px-6 py-1" />
 *       ) : (
 *         <MeterTrack filled={0} segments={40} />
 *       )}
 *     </Panel>
 *   )
 * }
 */

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
  onNavigate,
}: DashboardHomeProps) {
  const go = (path: string) => onNavigate?.(path)

  return (
    <div className="flex flex-1 flex-col gap-4 px-10 pt-3 pb-16 2xl:px-14">
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

      <EventsSection
        events={events}
        customers={customers}
        rangeLabel={rangeLabel}
        onQuickstart={() => go('/features')}
      />
    </div>
  )
}
