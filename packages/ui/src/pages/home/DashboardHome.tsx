import type { ReactNode } from 'react'
import { ArrowUpRightIcon, CalendarIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { DataFreshness, DataRegion } from '@ui/compositions/feedback/DataBoundary'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { ChartSkeleton, ValuePlaceholder } from '@ui/compositions/feedback/Skeletons'
import { Panel } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ArcGauge } from '../shared/ArcGauge'
import { HalfDonut } from '../shared/HalfDonut'
import type { DonutSlice } from '../shared/HalfDonut'
import { PillColumns } from '../shared/PillColumns'
import type { PillColumn, PillSeries } from '../shared/PillColumns'
import { NeedAttention, type AttentionPanel } from './NeedAttention'
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
 * endpoint — request latency, error counts — the panel says so
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
 * ReUI block adapted in place: `PillColumns` for the per-day subscription
 * stack, `HalfDonut` for the invoice gauge, `SegmentMeter` for the per-feature
 * usage rows and `ArcGauge` for key health. The
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
    'compositions/feedback/DataBoundary',
    'compositions/feedback/RetryAction',
    'compositions/feedback/Skeletons',
  ],
  note: 'Billing overview: needs-attention tasks, contracts and invoice payment status (metered usage and API keys parked), drawn with the shared chart library. Every figure is API-sourced or explicitly unavailable.',
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
   * The figures belong to a previous window and are
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

  /** Words for the window, e.g. "last 7 days". Used in the panels' subtitles. */
  rangeLabel: string

  subscriptions: SubscriptionsPanel
  invoices: InvoicesPanel
  /** Things a person has to act on. Omitted, the task list is not shown. */
  attention?: AttentionPanel | undefined
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

/* ---- 1. Range ----------------------------------------------------------- */

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
 * The range picker.
 *
 * It cuts the contracts and invoices panels to the same window.
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

/** A way out of an empty window: widen the range. */
interface Exit {
  label: string
  run: () => void
}

/* ---- 2. Recent subscriptions -------------------------------------------- */

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
              {subscriptions.basedOn ? (
                <p className="text-muted-foreground text-xs">{subscriptions.basedOn}</p>
              ) : null}
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

/* ---- 3. Invoice payment status ------------------------------------------ */

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
          {ready && invoices.basedOn ? (
            <p className="text-muted-foreground text-center text-xs">{invoices.basedOn}</p>
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

/* ---- 4. Usage by feature ------------------------------------------------ */

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

/* ---- 5. API ------------------------------------------------------------- */

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
  rangeLabel,
  subscriptions,
  invoices,
  attention,
  onNavigate,
}: DashboardHomeProps) {
  const go = (path: string) => onNavigate?.(path)

  // Ways out of an empty window. The range options run narrow to wide, so the
  // last is the widest; if it is already chosen there is nowhere wider to go.
  const widest = rangeOptions.at(-1)
  const widen: Exit | null =
    widest !== undefined && widest.id !== range
      ? { label: `Show ${widest.label.toLowerCase()}`, run: () => onRangeChange(widest.id) }
      : null

  return (
    <div className="flex flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      {/* The visible title lives in the shell's breadcrumb; the outline still needs one. */}
      <h1 className="sr-only">Overview</h1>

      {attention ? <NeedAttention attention={attention} onOpen={go} /> : null}

      <div className="flex justify-end">
        <RangeFilter rangeOptions={rangeOptions} range={range} onRangeChange={onRangeChange} />
      </div>

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
