import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts'
import { CalendarIcon, DownloadIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@ui/components/primitives/chart'
import { DetailTabs, OverviewTiles, type OverviewTile } from '@ui/compositions/detail/DetailKit'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { FilterSelect, type FilterOption } from '../home/DashboardHome'
import { DetailTable } from '../shared/DetailTable'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from './reportCsv'
import { Panel } from '../shared/Panel'
import { TrendBadge, toneColor, toneRamp } from '../shared/charts'

export const RevenueReportProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/detail/DetailKit',
    'pages/shared/Panel',
    'pages/shared/DetailTable',
    'pages/shared/charts',
    'ui/chart',
  ],
  note: 'Revenue, as the reference draws it: a filter row, four headline tiles, report tabs, and each report in a Panel with flush tiles over a chart and a table. Every figure comes in ready; the page owns the requests.',
})

/* ---- Types ---------------------------------------------------------------- */

export type RevenueView =
  'overview' | 'revenue' | 'customers' | 'receivables' | 'payments' | 'usage'

/** Where a report stands. `unavailable` is a stated gap, not a failure. */
export type ReportStatus = 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'

/** One headline figure, already formatted. */
export interface ReportFigure {
  value: string
  detail?: string | undefined
  /** Change against the comparison period, as a fraction (0.12 = +12%). */
  change?: number | null | undefined
  /** For days to pay, where going down is the good direction. */
  lowerIsBetter?: boolean | undefined
}

export interface ReportState {
  status: ReportStatus
  /** Why it is unavailable or failed, as a sentence. */
  reason?: string | undefined
  onRetry?: (() => void) | undefined
  /** Disclosure, e.g. "From the latest 200 invoices." */
  basedOn?: string | undefined
}

/** One bucket of revenue over time. Chart values; the figures beside them are formatted. */
export interface RevenuePoint {
  label: string
  revenue: number
  /** The same bucket in the comparison period. */
  previous?: number | undefined
  /** The two figures formatted as money, for the table under the chart. */
  display?: { revenue: string; previous?: string | undefined } | undefined
}

export interface CustomerRevenueRow {
  id: string
  name: string
  revenue: number
  usage: number
  contract: number
  /** Formatted money for the same three. */
  display: { revenue: string; usage: string; contract: string }
  /** Share of the period's revenue, 0–1. */
  share: number
}

export interface CreditRow {
  id: string
  name: string
  paid: number
  free: number
  total: number
  /** Share of all credits consumed, 0–1. */
  share: number
  display: { paid: string; free: string; total: string; share: string }
}

export interface CreditTypeRow {
  id: string
  label: string
  customers: number
  amount: number
  display: { amount: string }
}

export interface AgingBucket {
  id: string
  label: string
  amount: number
  display: string
  tone: 'neutral' | 'warning' | 'critical' | 'good'
}

export interface OverdueCustomerRow {
  id: string
  name: string
  /** How many invoices are overdue; omitted when the source does not count them. */
  invoices?: number | undefined
  overdue: number
  outstanding: number
  display: { overdue: string; outstanding: string }
  oldestDays: number
}

export interface PayerRow {
  id: string
  name: string
  /** Paid invoices and amount collected; omitted when the source does not report them. */
  paid?: number | undefined
  collected?: string | undefined
  averageDays: number
}

export interface RevenueReportProps {
  title?: string
  filters: {
    range: string
    rangeOptions: FilterOption[]
    onRangeChange: (range: string) => void
    grain: string
    grainOptions: FilterOption[]
    onGrainChange: (grain: string) => void
    compare: string
    compareOptions: FilterOption[]
    onCompareChange: (compare: string) => void
    currency: string
    currencyOptions: FilterOption[]
    onCurrencyChange: (currency: string) => void
  }
  /** e.g. "last 90 days", lower case: it is read inside sentences. */
  rangeLabel: string
  comparing: boolean
  view: RevenueView
  onViewChange: (view: RevenueView) => void

  headline: {
    status: ReportStatus
    revenue: ReportFigure
    arpu: ReportFigure
    outstanding: ReportFigure
    overdue: ReportFigure
  }

  revenue: ReportState & {
    total: ReportFigure
    usage: ReportFigure
    contract: ReportFigure
    usageShare: string
    /** `month`, `week` or `day`: what one bar is. */
    grain: string
    series: RevenuePoint[]
  }

  customers: ReportState & {
    rows: CustomerRevenueRow[]
    billed: number
    arpu: ReportFigure
    topTenShare: string
    onOpenCustomer?: ((id: string) => void) | undefined
    /** One server page of customers by revenue. */
    all?:
      | (ReportState & {
          rows: CustomerRevenueRow[]
          offset: number
          size: number
          hasMore: boolean
          onPage: (offset: number) => void
        })
      | undefined
    credits?:
      | (ReportState & {
          rows: CreditRow[]
          total: string
          toppedUp: string
          paidShare: string
          consumedTypes: CreditTypeRow[]
          topupTypes: CreditTypeRow[]
        })
      | undefined
  }

  receivables: ReportState & {
    buckets: AgingBucket[]
    outstanding: string
    overdue: string
    overdueShare: string
    notYetDue: string
    noDueDate: string
    customers: OverdueCustomerRow[]
    onOpenCustomer?: ((id: string) => void) | undefined
  }

  payments: ReportState & {
    average: ReportFigure
    median: string
    /** Invoices paid in the range; omitted when the source does not count them. */
    paidCount?: number | undefined
    withinWeek: string
    series: { label: string; days: number | null }[]
    payers: PayerRow[]
    onOpenCustomer?: ((id: string) => void) | undefined
  }

  usage: ReportState & {
    series: { label: string; events: number }[]
    total: string
    weeklyAverage: string
    peak: string
  }
}

const TABS: { value: RevenueView; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'customers', label: 'Customers' },
  { value: 'receivables', label: 'Receivables' },
  { value: 'payments', label: 'Payments' },
  { value: 'usage', label: 'Usage' },
]

/* ---- Small parts ---------------------------------------------------------- */

const axisTick = { fontSize: 11 }
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const short = (value: number) => compact.format(value)
const percent = (value: number) => `${Math.round(value * 100)}%`

function Change({ figure }: { figure: ReportFigure }) {
  if (figure.change == null || !Number.isFinite(figure.change)) return null
  const value = figure.lowerIsBetter ? -figure.change : figure.change
  return <TrendBadge percent={Math.round(value * 1000) / 10} />
}

function tile(label: string, figure: ReportFigure, comparing: boolean): OverviewTile {
  return {
    label,
    value: figure.value,
    ...(figure.detail ? { detail: figure.detail } : {}),
    ...(comparing ? { delta: <Change figure={figure} /> } : {}),
  }
}

/** One legend line under a chart: a swatch, a name and, optionally, a total. */
function Legend({
  items,
}: {
  items: { label: string; color: string; value?: string; dashed?: boolean }[]
}) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 px-5 pt-2 pb-4 text-xs">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block h-2 w-3 rounded-sm',
              item.dashed && 'h-0 border-t border-dashed',
            )}
            style={item.dashed ? { borderColor: item.color } : { background: item.color }}
          />
          {item.label}
          {item.value ? <span className="text-foreground tabular-nums">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** A share of a whole as a thin bar and a percentage. */
function ShareBar({ value, color }: { value: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }}
        />
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{percent(value)}</span>
    </span>
  )
}

/** What a report shows when it is not ready: a skeleton, an error with retry, or a stated gap. */
function NotReady({
  state,
  height = 260,
  empty,
}: {
  state: ReportState
  height?: number
  empty: string
}) {
  if (state.status === 'loading') {
    return (
      <div className="p-5" aria-busy="true">
        <Skeleton className="w-full" style={{ height }} />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
        <p className="text-sm">{state.reason ?? 'This report could not be loaded.'}</p>
        {state.onRetry ? <RetryAction onRetry={state.onRetry} size="sm" /> : null}
      </div>
    )
  }
  return (
    <SectionEmpty
      scene="billing"
      title={state.status === 'unavailable' ? 'Not available yet' : empty}
      description={state.reason}
    />
  )
}

/** A ready report whose rows are all gone is empty. */
function withData<T extends ReportState>(state: T, hasData: boolean): T {
  return state.status === 'ready' && !hasData ? { ...state, status: 'empty' } : state
}

/**
 * Where a chart would be when it has nothing to draw: the empty state, not
 * axes over a line at zero. Only the chart gives way; the figures above it
 * come from their own reads and stay.
 */
function NoChartData({ title }: { title: string }) {
  return <SectionEmpty scene="billing" title={title} />
}

const daysHaveData = (series: { days: number | null }[]) =>
  series.some((point) => point.days !== null)
const eventsHaveData = (series: { events: number }[]) => series.some((point) => point.events > 0)

const revenueHasData = (series: RevenuePoint[]) =>
  series.some((point) => point.revenue !== 0 || (point.previous ?? 0) !== 0)

/** Customers that billed something; a zero bar is not a customer to rank. */
const billedRows = (rows: CustomerRevenueRow[]) => rows.filter((row) => row.revenue > 0)

function BasedOn({ text }: { text?: string | undefined }) {
  return text ? <p className="text-muted-foreground border-t px-5 py-3 text-xs">{text}</p> : null
}

function ViewReport({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="h-7 px-2.5" onClick={onClick}>
      View report
    </Button>
  )
}

function CsvButton<T>({
  name,
  rangeLabel,
  columns,
  rows,
}: {
  name: string
  rangeLabel: string
  columns: CsvColumn<T>[]
  rows: T[]
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-2.5"
      disabled={rows.length === 0}
      aria-label={`Download ${name} as CSV`}
      onClick={() => downloadCsv(csvFilename(name, rangeLabel), toCsv(columns, rows))}
    >
      <DownloadIcon className="size-3.5" />
      CSV
    </Button>
  )
}

const asOfToday = () => `as of ${new Date().toLocaleDateString('en-CA')}`

const withCsv = (csv: ReactNode, extra?: ReactNode) => (
  <div className="flex items-center gap-2">
    {csv}
    {extra}
  </div>
)

const revenueColumns = (comparing: boolean): CsvColumn<RevenuePoint>[] => [
  { header: 'period', value: (row) => row.label },
  { header: 'revenue', value: (row) => row.revenue },
  ...(comparing ? [{ header: 'previous', value: (row: RevenuePoint) => row.previous }] : []),
]

const AGING_COLUMNS: CsvColumn<AgingBucket>[] = [
  { header: 'bucket', value: (row) => row.label },
  { header: 'amount', value: (row) => row.amount },
]

const DAYS_COLUMNS: CsvColumn<{ label: string; days: number | null }>[] = [
  { header: 'period', value: (row) => row.label },
  { header: 'average_days', value: (row) => row.days },
]

const EVENTS_COLUMNS: CsvColumn<{ label: string; events: number }>[] = [
  { header: 'period', value: (row) => row.label },
  { header: 'events', value: (row) => row.events },
]

export const CUSTOMER_COLUMNS: CsvColumn<CustomerRevenueRow>[] = [
  { header: 'customer', value: (row) => row.name },
  { header: 'revenue', value: (row) => row.revenue },
  { header: 'contract', value: (row) => (row.display.contract === '—' ? '' : row.contract) },
  { header: 'usage', value: (row) => (row.display.usage === '—' ? '' : row.usage) },
  { header: 'share', value: (row) => row.share },
]

const RANKED_CUSTOMER_COLUMNS: CsvColumn<CustomerRevenueRow & { rank: number }>[] = [
  { header: 'rank', value: (row) => row.rank },
  ...CUSTOMER_COLUMNS,
]

const CREDIT_CUSTOMER_COLUMNS: CsvColumn<CreditRow>[] = [
  { header: 'customer', value: (row) => row.name },
  { header: 'consumed', value: (row) => row.total },
  { header: 'paid', value: (row) => row.paid },
  { header: 'free', value: (row) => row.free },
  { header: 'share', value: (row) => row.share },
]

const CREDIT_TYPE_COLUMNS: CsvColumn<CreditTypeRow>[] = [
  { header: 'type', value: (row) => row.label },
  { header: 'customers', value: (row) => row.customers },
  { header: 'amount', value: (row) => row.amount },
]

const OVERDUE_COLUMNS: CsvColumn<OverdueCustomerRow>[] = [
  { header: 'customer', value: (row) => row.name },
  { header: 'overdue_invoices', value: (row) => row.invoices },
  { header: 'overdue', value: (row) => row.overdue },
  { header: 'outstanding', value: (row) => row.outstanding },
  { header: 'oldest_days', value: (row) => row.oldestDays },
]

const PAYER_COLUMNS: CsvColumn<PayerRow>[] = [
  { header: 'customer', value: (row) => row.name },
  { header: 'paid_invoices', value: (row) => row.paid },
  { header: 'collected', value: (row) => row.collected },
  { header: 'average_days', value: (row) => row.averageDays },
]

function Surface({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex flex-col overflow-hidden rounded-lg border">{children}</div>
  )
}

/* ---- Charts ---------------------------------------------------------------- */

const REVENUE = toneColor('series-1')
const PREVIOUS = 'var(--foreground)'

function RevenueChart({
  series,
  comparing,
  height = 280,
  formatAxis,
}: {
  series: RevenuePoint[]
  comparing: boolean
  height?: number
  formatAxis: (value: number) => string
}) {
  const config: ChartConfig = {
    revenue: { label: 'Revenue', color: REVENUE },
    previous: { label: 'Previous period', color: PREVIOUS },
  }
  return (
    <ChartContainer config={config} className="w-full px-3 pt-4" style={{ height }}>
      <ComposedChart
        data={series}
        margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={16}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={52}
          tick={axisTick}
          tickFormatter={formatAxis}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
        {comparing ? (
          <Line
            dataKey="previous"
            type="monotone"
            stroke="var(--color-previous)"
            strokeDasharray="4 4"
            strokeWidth={1.25}
            dot={false}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}

const AGING_TONE: Record<AgingBucket['tone'], string> = {
  neutral: toneColor('series-3'),
  good: toneColor('good'),
  warning: toneColor('warning'),
  critical: toneColor('critical'),
}

function AgingChart({ buckets, height = 240 }: { buckets: AgingBucket[]; height?: number }) {
  const config: ChartConfig = { amount: { label: 'Balance', color: AGING_TONE.neutral } }
  return (
    <ChartContainer config={config} className="w-full px-3 pt-4 pb-3" style={{ height }}>
      <BarChart
        data={buckets}
        margin={{ top: 20, right: 8, left: 8, bottom: 0 }}
        barCategoryGap="18%"
      >
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={axisTick}
          interval={0}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent hideIndicator />}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
          {buckets.map((bucket) => (
            <Cell key={bucket.id} fill={AGING_TONE[bucket.tone]} />
          ))}
          <LabelList
            dataKey="display"
            position="top"
            className="fill-muted-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function DaysChart({
  series,
  height = 240,
}: {
  series: { label: string; days: number | null }[]
  height?: number
}) {
  const config: ChartConfig = { days: { label: 'Average days to pay', color: REVENUE } }
  return (
    <ChartContainer config={config} className="w-full px-3 pt-4 pb-3" style={{ height }}>
      <LineChart data={series} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={16}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={36}
          tick={axisTick}
          tickFormatter={(v: number) => `${v}d`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="days"
          type="monotone"
          stroke="var(--color-days)"
          strokeWidth={1.75}
          dot={{ r: 2.5, fill: 'var(--color-days)' }}
        />
      </LineChart>
    </ChartContainer>
  )
}

const [USAGE_TONE, CONTRACT_TONE] = toneRamp('series-1', 2) as [string, string]

function CustomerBars({ rows, height }: { rows: CustomerRevenueRow[]; height: number }) {
  const config: ChartConfig = {
    usage: { label: 'Usage', color: USAGE_TONE },
    contract: { label: 'Contract', color: CONTRACT_TONE },
  }
  const data = rows.map((row) => ({ ...row, total: row.display.revenue }))
  return (
    <ChartContainer config={config} className="w-full px-3 pt-4 pb-1" style={{ height }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 72, left: 8, bottom: 0 }}
        barCategoryGap="26%"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          width={130}
          tick={axisTick}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="usage" stackId="c" fill="var(--color-usage)" />
        <Bar dataKey="contract" stackId="c" fill="var(--color-contract)" radius={[0, 3, 3, 0]}>
          <LabelList
            dataKey="total"
            position="right"
            className="fill-muted-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function EventsChart({
  series,
  height = 240,
}: {
  series: { label: string; events: number }[]
  height?: number
}) {
  const config: ChartConfig = { events: { label: 'Events', color: REVENUE } }
  return (
    <ChartContainer config={config} className="w-full px-3 pt-4 pb-3" style={{ height }}>
      <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="revenue-events-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-events)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-events)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={32}
        />
        <YAxis axisLine={false} tickLine={false} width={44} tick={axisTick} tickFormatter={short} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="events"
          type="monotone"
          stroke="var(--color-events)"
          strokeWidth={1.5}
          fill="url(#revenue-events-fill)"
        />
      </AreaChart>
    </ChartContainer>
  )
}

/* ---- The page -------------------------------------------------------------- */

/**
 * Revenue, rebuilt on the reference. The filters cut every report but
 * receivables, which is as of today. Every figure arrives formatted, and every
 * report states its own state: a report the API cannot answer says so rather
 * than drawing a zero.
 */
export function RevenueReport(props: RevenueReportProps) {
  const { filters, headline, comparing, view, onViewChange } = props
  const figure = (value: ReportFigure): ReportFigure =>
    headline.status === 'ready'
      ? value
      : { value: '—', detail: headline.status === 'loading' ? 'Loading…' : value.detail }

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium tracking-tight">{props.title ?? 'Revenue'}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect
            filter={{
              label: 'Range',
              value: filters.range,
              options: filters.rangeOptions,
              onChange: filters.onRangeChange,
              icon: <CalendarIcon aria-hidden className="size-3.5" />,
            }}
          />
          <FilterSelect
            filter={{
              label: 'Granularity',
              value: filters.grain,
              options: filters.grainOptions,
              onChange: filters.onGrainChange,
            }}
          />
          <FilterSelect
            filter={{
              label: 'Compare',
              value: filters.compare,
              options: filters.compareOptions,
              onChange: filters.onCompareChange,
            }}
          />
          {filters.currencyOptions.length > 1 ? (
            <FilterSelect
              filter={{
                label: 'Currency',
                value: filters.currency,
                options: filters.currencyOptions,
                onChange: filters.onCurrencyChange,
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Outstanding and overdue are as of today, so they never carry a change. */}
      <OverviewTiles
        variant="row"
        tiles={[
          tile('Revenue', figure(headline.revenue), comparing),
          tile('ARPU', figure(headline.arpu), comparing),
          tile('Outstanding', figure(headline.outstanding), false),
          tile('Overdue', figure(headline.overdue), false),
        ]}
      />

      <DetailTabs tabs={TABS} value={view} onChange={(next) => onViewChange(next as RevenueView)} />

      {/* Names the report for assistive tech, so the panels' headings sit under it. */}
      <h2 className="sr-only">
        {TABS.find((tab) => tab.value === view)?.label ?? 'Overview'} report
      </h2>
      {view === 'overview' ? <OverviewTab {...props} /> : null}
      {view === 'revenue' ? <RevenueTab {...props} /> : null}
      {view === 'customers' ? <CustomersTab {...props} /> : null}
      {view === 'receivables' ? <ReceivablesTab {...props} /> : null}
      {view === 'payments' ? <PaymentsTab {...props} /> : null}
      {view === 'usage' ? <UsageTab {...props} /> : null}
    </div>
  )
}

const axisMoney = (value: number) => short(value)

function OverviewTab(props: RevenueReportProps) {
  const { revenue, receivables, payments, customers, usage, comparing, rangeLabel, onViewChange } =
    props
  const topFive = billedRows(customers.rows).slice(0, 5)
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Revenue over time"
        description={`Invoiced revenue per ${revenue.grain}, ${rangeLabel}`}
        action={withCsv(
          <CsvButton
            name="Revenue over time"
            rangeLabel={rangeLabel}
            columns={revenueColumns(comparing)}
            rows={revenue.status === 'ready' ? revenue.series : []}
          />,
          <ViewReport onClick={() => onViewChange('revenue')} />,
        )}
      >
        <Surface>
          {revenue.status === 'ready' ? (
            <>
              <OverviewTiles
                variant="flush"
                tiles={[
                  tile('Total revenue', revenue.total, comparing),
                  tile('Usage revenue', revenue.usage, false),
                  tile('Contract revenue', revenue.contract, false),
                ]}
              />
              {revenueHasData(revenue.series) ? (
                <>
                  <RevenueChart
                    series={revenue.series}
                    comparing={comparing}
                    height={260}
                    formatAxis={axisMoney}
                  />
                  <Legend
                    items={[
                      { label: 'Revenue', color: REVENUE },
                      ...(comparing
                        ? [{ label: 'Previous period', color: PREVIOUS, dashed: true }]
                        : []),
                    ]}
                  />
                </>
              ) : (
                <NoChartData title="No revenue in this range" />
              )}
            </>
          ) : (
            <NotReady state={revenue} empty="No revenue in this range" />
          )}
          <BasedOn text={revenue.basedOn} />
        </Surface>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Receivables aging"
          description="Unpaid balance by days past due, as of today"
          action={withCsv(
            <CsvButton
              name="Receivables aging"
              rangeLabel={asOfToday()}
              columns={AGING_COLUMNS}
              rows={receivables.status === 'ready' ? receivables.buckets : []}
            />,
            <ViewReport onClick={() => onViewChange('receivables')} />,
          )}
        >
          <Surface>
            {receivables.status === 'ready' ? (
              <>
                <OverviewTiles
                  variant="flush"
                  tiles={[
                    { label: 'Outstanding', value: receivables.outstanding },
                    {
                      label: 'Overdue',
                      value: receivables.overdue,
                      detail: `${receivables.overdueShare} of outstanding`,
                    },
                  ]}
                />
                <AgingChart buckets={receivables.buckets} />
              </>
            ) : (
              <NotReady state={receivables} height={240} empty="Nothing outstanding" />
            )}
            <BasedOn text={receivables.basedOn} />
          </Surface>
        </Panel>

        <Panel
          title="Days to pay over time"
          description="Average days from issue to payment"
          action={withCsv(
            <CsvButton
              name="Days to pay"
              rangeLabel={rangeLabel}
              columns={DAYS_COLUMNS}
              rows={payments.status === 'ready' ? payments.series : []}
            />,
            <ViewReport onClick={() => onViewChange('payments')} />,
          )}
        >
          <Surface>
            {payments.status === 'ready' ? (
              <>
                <OverviewTiles
                  variant="flush"
                  tiles={[
                    { label: 'Average', value: payments.average.value },
                    { label: 'Median', value: payments.median },
                  ]}
                />
                {daysHaveData(payments.series) ? (
                  <DaysChart series={payments.series} />
                ) : (
                  <NoChartData title="No payments in this range" />
                )}
              </>
            ) : (
              <NotReady state={payments} height={240} empty="No payments in this range" />
            )}
            <BasedOn text={payments.basedOn} />
          </Surface>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Top 5 customers"
          description="Highest revenue in the period"
          action={withCsv(
            <CsvButton
              name="Top 5 customers"
              rangeLabel={rangeLabel}
              columns={CUSTOMER_COLUMNS}
              rows={customers.status === 'ready' ? topFive : []}
            />,
            <ViewReport onClick={() => onViewChange('customers')} />,
          )}
        >
          <Surface>
            {customers.status === 'ready' && topFive.length === 0 ? (
              <NoChartData title="No billed customers in this range" />
            ) : customers.status === 'ready' ? (
              <>
                <CustomerBars rows={topFive} height={236} />
                <Legend
                  items={[
                    { label: 'Usage', color: USAGE_TONE },
                    { label: 'Contract', color: CONTRACT_TONE },
                  ]}
                />
              </>
            ) : (
              <NotReady state={customers} height={236} empty="No billed customers in this range" />
            )}
          </Surface>
        </Panel>

        <Panel
          title="Events volume"
          description="Usage events ingested per day"
          action={withCsv(
            <CsvButton
              name="Events volume"
              rangeLabel={rangeLabel}
              columns={EVENTS_COLUMNS}
              rows={usage.status === 'ready' ? usage.series : []}
            />,
            <ViewReport onClick={() => onViewChange('usage')} />,
          )}
        >
          <Surface>
            {usage.status === 'ready' ? (
              <>
                <OverviewTiles
                  variant="flush"
                  tiles={[
                    { label: 'Total events', value: usage.total },
                    { label: 'Peak day', value: usage.peak },
                  ]}
                />
                {eventsHaveData(usage.series) ? (
                  <EventsChart series={usage.series} height={220} />
                ) : (
                  <NoChartData title="No events in this range" />
                )}
                <BasedOn text={usage.basedOn} />
              </>
            ) : (
              <NotReady state={usage} height={220} empty="No events in this range" />
            )}
          </Surface>
        </Panel>
      </div>
    </div>
  )
}

const compactMoney = (value: number) => short(value)

function RevenueTable({ series, comparing }: { series: RevenuePoint[]; comparing: boolean }) {
  const rows = series.map((point, index) => ({ ...point, id: String(index), index }))
  type Row = (typeof rows)[number]
  const change = (row: Row) => (row.previous ? (row.revenue - row.previous) / row.previous : null)
  return (
    <div className="border-t">
      <DetailTable<Row>
        compact
        label="Revenue by period"
        noun="periods"
        rows={rows}
        toolbar={false}
        columns={[
          {
            key: 'period',
            header: 'Period',
            sortBy: (row) => row.index,
            cell: (row) => <span className="font-medium">{row.label}</span>,
          },
          {
            key: 'revenue',
            header: 'Revenue',
            sortBy: (row) => row.revenue,
            cell: (row) => (
              <span className="tabular-nums">
                {row.display?.revenue ?? compactMoney(row.revenue)}
              </span>
            ),
          },
          ...(comparing
            ? [
                {
                  key: 'previous',
                  header: 'Previous period',
                  sortBy: (row: Row) => row.previous ?? 0,
                  cell: (row: Row) => (
                    <span className="text-muted-foreground tabular-nums">
                      {row.previous == null
                        ? '—'
                        : (row.display?.previous ?? compactMoney(row.previous))}
                    </span>
                  ),
                },
                {
                  key: 'change',
                  header: 'Change',
                  sortBy: (row: Row) => change(row) ?? 0,
                  cell: (row: Row) => {
                    const value = change(row)
                    return value === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Change figure={{ value: '', change: value }} />
                    )
                  },
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}

function RevenueTab(props: RevenueReportProps) {
  const { revenue, comparing, rangeLabel } = props
  return (
    <Panel
      title="Revenue over time"
      action={
        <CsvButton
          name="Revenue over time"
          rangeLabel={rangeLabel}
          columns={revenueColumns(comparing)}
          rows={revenue.status === 'ready' ? revenue.series : []}
        />
      }
      description={`Invoiced revenue per ${revenue.grain}, ${rangeLabel}`}
    >
      <Surface>
        {revenue.status === 'ready' ? (
          <>
            <OverviewTiles
              variant="flush"
              tiles={[
                tile('Total revenue', revenue.total, comparing),
                tile('Usage revenue', revenue.usage, comparing),
                tile('Contract revenue', revenue.contract, comparing),
                { label: 'Usage share', value: revenue.usageShare },
              ]}
            />
            {revenueHasData(revenue.series) ? (
              <>
                <RevenueChart
                  series={revenue.series}
                  comparing={comparing}
                  formatAxis={axisMoney}
                />
                <Legend
                  items={[
                    { label: 'Revenue', color: REVENUE },
                    ...(comparing
                      ? [{ label: 'Previous period', color: PREVIOUS, dashed: true }]
                      : []),
                  ]}
                />
                <RevenueTable series={revenue.series} comparing={comparing} />
              </>
            ) : (
              <NoChartData title="No revenue in this range" />
            )}
          </>
        ) : (
          <NotReady state={revenue} height={320} empty="No revenue in this range" />
        )}
        <BasedOn text={revenue.basedOn} />
      </Surface>
    </Panel>
  )
}

function CreditTypeTable({
  label,
  header,
  rows,
}: {
  label: string
  header: string
  rows: CreditTypeRow[]
}) {
  return (
    <DetailTable<CreditTypeRow>
      compact
      label={label}
      noun="types"
      rows={rows}
      toolbar={false}
      footer={false}
      columns={[
        {
          key: 'label',
          header,
          sortBy: (row) => row.label,
          cell: (row) => <span className="font-medium">{row.label}</span>,
        },
        {
          key: 'customers',
          header: 'Customers',
          sortBy: (row) => row.customers,
          cell: (row) => <span className="tabular-nums">{row.customers}</span>,
        },
        {
          key: 'amount',
          header: 'Amount',
          sortBy: (row) => row.amount,
          cell: (row) => <span className="tabular-nums">{row.display.amount}</span>,
        },
      ]}
    />
  )
}

function CustomersTab(props: RevenueReportProps) {
  const { customers, comparing, rangeLabel } = props
  const top = billedRows(customers.rows).slice(0, 10)
  const largest = top[0]
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Top 10 customers"
        action={
          <CsvButton
            name="Top 10 customers"
            rangeLabel={rangeLabel}
            columns={CUSTOMER_COLUMNS}
            rows={customers.status === 'ready' ? top : []}
          />
        }
        description={`Revenue per customer, ${rangeLabel}, split into usage and contract`}
      >
        <Surface>
          {customers.status === 'ready' ? (
            <>
              <OverviewTiles
                variant="flush"
                tiles={[
                  { label: 'Billed customers', value: String(customers.billed) },
                  tile('ARPU', customers.arpu, comparing),
                  { label: 'Top 10 share', value: customers.topTenShare },
                  {
                    label: 'Largest customer',
                    value: largest?.display.revenue ?? '—',
                    ...(largest ? { detail: largest.name } : {}),
                  },
                ]}
              />
              {top.length > 0 ? (
                <>
                  <CustomerBars rows={top} height={Math.max(160, top.length * 32 + 20)} />
                  <Legend
                    items={[
                      { label: 'Usage', color: USAGE_TONE },
                      { label: 'Contract', color: CONTRACT_TONE },
                    ]}
                  />
                </>
              ) : (
                <NoChartData title="No billed customers in this range" />
              )}
            </>
          ) : (
            <NotReady state={customers} height={330} empty="No billed customers in this range" />
          )}
        </Surface>
      </Panel>

      {customers.credits ? (
        <>
          {/* Consumed and topped up are two reports: each its own titled panel. */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Credits consumed"
              action={
                <CsvButton
                  name="Credits consumed"
                  rangeLabel={rangeLabel}
                  columns={CREDIT_TYPE_COLUMNS}
                  rows={customers.credits.status === 'ready' ? customers.credits.consumedTypes : []}
                />
              }
              description={`Wallet credits applied to invoices, ${rangeLabel}, by credit type`}
            >
              <Surface>
                {customers.credits.status === 'ready' &&
                customers.credits.consumedTypes.length > 0 ? (
                  <>
                    <OverviewTiles
                      variant="flush"
                      tiles={[
                        { label: 'Total consumed', value: customers.credits.total },
                        {
                          label: 'Customers using credits',
                          value: String(customers.credits.rows.length),
                        },
                        { label: 'Paid share', value: customers.credits.paidShare },
                      ]}
                    />
                    <div className="p-5">
                      <CreditTypeTable
                        label="Credits consumed by type"
                        header="Credit type"
                        rows={customers.credits.consumedTypes}
                      />
                    </div>
                  </>
                ) : (
                  <NotReady
                    state={withData(customers.credits, false)}
                    height={200}
                    empty="No credits consumed in this range"
                  />
                )}
                <BasedOn
                  text={
                    customers.credits.status === 'ready' ? customers.credits.basedOn : undefined
                  }
                />
              </Surface>
            </Panel>

            <Panel
              title="Credits topped up"
              action={
                <CsvButton
                  name="Credits topped up"
                  rangeLabel={rangeLabel}
                  columns={CREDIT_TYPE_COLUMNS}
                  rows={customers.credits.status === 'ready' ? customers.credits.topupTypes : []}
                />
              }
              description={`Wallet credits added, ${rangeLabel}, by source`}
            >
              <Surface>
                {customers.credits.status === 'ready' && customers.credits.topupTypes.length > 0 ? (
                  <>
                    <OverviewTiles
                      variant="flush"
                      tiles={[{ label: 'Total topped up', value: customers.credits.toppedUp }]}
                    />
                    <div className="p-5">
                      <CreditTypeTable
                        label="Credits topped up by source"
                        header="Source"
                        rows={customers.credits.topupTypes}
                      />
                    </div>
                  </>
                ) : (
                  <NotReady
                    state={withData(customers.credits, false)}
                    height={200}
                    empty="No credits topped up in this range"
                  />
                )}
              </Surface>
            </Panel>
          </div>

          {customers.credits.status === 'ready' && customers.credits.rows.length > 0 ? (
            <Panel
              title="Credit consumption by customer"
              action={
                <CsvButton
                  name="Credit consumption by customer"
                  rangeLabel={rangeLabel}
                  columns={CREDIT_CUSTOMER_COLUMNS}
                  rows={customers.credits?.status === 'ready' ? customers.credits.rows : []}
                />
              }
              description={`Credits applied to invoices per customer, ${rangeLabel}, split into paid and free`}
            >
              <Surface>
                <DetailTable<CreditRow>
                  compact
                  label="Credit consumption by customer"
                  noun="customers"
                  rows={customers.credits.rows}
                  {...(customers.onOpenCustomer
                    ? { onRowClick: (row: CreditRow) => customers.onOpenCustomer?.(row.id) }
                    : {})}
                  columns={[
                    {
                      key: 'name',
                      header: 'Customer',
                      width: 220,
                      sortBy: (row) => row.name,
                      cell: (row) => <span className="font-medium">{row.name}</span>,
                    },
                    {
                      key: 'total',
                      header: 'Consumed',
                      sortBy: (row) => row.total,
                      cell: (row) => <span className="tabular-nums">{row.display.total}</span>,
                    },
                    {
                      key: 'share',
                      header: 'Share',
                      sortBy: (row) => row.total,
                      cell: (row) => (
                        <span className="text-muted-foreground tabular-nums">
                          {row.display.share}
                        </span>
                      ),
                    },
                    {
                      key: 'paid',
                      header: 'Paid credits',
                      sortBy: (row) => row.paid,
                      cell: (row) => (
                        <span className="text-muted-foreground tabular-nums">
                          {row.display.paid}
                        </span>
                      ),
                    },
                    {
                      key: 'free',
                      header: 'Free credits',
                      sortBy: (row) => row.free,
                      cell: (row) => (
                        <span className="text-muted-foreground tabular-nums">
                          {row.display.free}
                        </span>
                      ),
                    },
                  ]}
                />
              </Surface>
            </Panel>
          ) : null}
        </>
      ) : null}

      {customers.all ? (
        <Panel
          title="All customers"
          action={
            <CsvButton
              name={`All customers rows ${(customers.all.offset ?? 0) + 1}-${(customers.all.offset ?? 0) + (customers.all.status === 'ready' ? customers.all.rows.length : 0)}`}
              rangeLabel={rangeLabel}
              columns={RANKED_CUSTOMER_COLUMNS}
              rows={
                customers.all.status === 'ready'
                  ? customers.all.rows.map((row, index) => ({
                      ...row,
                      rank: (customers.all?.offset ?? 0) + index + 1,
                    }))
                  : []
              }
            />
          }
          description="Ordered by revenue, highest first"
        >
          <Surface>
            {customers.all.status === 'error' ? (
              <NotReady state={customers.all} empty="No customers in this range" />
            ) : (
              <DetailTable<CustomerRevenueRow & { rank: number }>
                compact
                label="Customers by revenue"
                noun="customers"
                rows={customers.all.rows.map((row, index) => ({
                  ...row,
                  rank: (customers.all?.offset ?? 0) + index + 1,
                }))}
                footer={false}
                toolbar={false}
                pageSize={customers.all.size}
                isLoading={customers.all.status === 'loading'}
                {...(customers.onOpenCustomer
                  ? { onRowClick: (row: CustomerRevenueRow) => customers.onOpenCustomer?.(row.id) }
                  : {})}
                columns={[
                  {
                    key: 'rank',
                    header: '#',
                    width: 56,
                    cell: (row) => <span className="text-muted-foreground">{row.rank}</span>,
                  },
                  {
                    key: 'name',
                    header: 'Customer',
                    width: 220,
                    cell: (row) => <span className="font-medium">{row.name}</span>,
                  },
                  {
                    key: 'revenue',
                    header: 'Revenue',
                    cell: (row) => <span className="tabular-nums">{row.display.revenue}</span>,
                  },
                  {
                    key: 'contract',
                    header: 'Contract',
                    cell: (row) => (
                      <span className="text-muted-foreground tabular-nums">
                        {row.display.contract}
                      </span>
                    ),
                  },
                  {
                    key: 'usage',
                    header: 'Usage',
                    cell: (row) => (
                      <span className="text-muted-foreground tabular-nums">
                        {row.display.usage}
                      </span>
                    ),
                  },
                  {
                    key: 'share',
                    header: 'Share of total',
                    cell: (row) => <ShareBar value={row.share} color={REVENUE} />,
                  },
                ]}
              />
            )}
            {customers.all.status === 'error' ? null : (
              <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {customers.all.status === 'loading'
                    ? ''
                    : customers.all.rows.length === 0
                      ? 'No customers on this page'
                      : `${customers.all.offset + 1} - ${customers.all.offset + customers.all.rows.length}`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={customers.all.offset === 0 || customers.all.status === 'loading'}
                    onClick={() =>
                      customers.all?.onPage(Math.max(0, customers.all.offset - customers.all.size))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!customers.all.hasMore || customers.all.status === 'loading'}
                    onClick={() => customers.all?.onPage(customers.all.offset + customers.all.size)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        </Panel>
      ) : null}
    </div>
  )
}

function agingOf(days: number) {
  return days > 90 ? '90+ days' : days > 60 ? '61–90 days' : days > 30 ? '31–60 days' : '1–30 days'
}

function ReceivablesTab({ receivables }: RevenueReportProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Receivables aging"
        action={
          <CsvButton
            name="Receivables aging"
            rangeLabel={asOfToday()}
            columns={AGING_COLUMNS}
            rows={receivables.status === 'ready' ? receivables.buckets : []}
          />
        }
        description="Unpaid balance on finalized invoices, by days past the due date. As of today: the range and comparison do not apply."
      >
        <Surface>
          {receivables.status === 'ready' ? (
            <>
              <OverviewTiles
                variant="flush"
                tiles={[
                  { label: 'Outstanding', value: receivables.outstanding },
                  {
                    label: 'Overdue',
                    value: receivables.overdue,
                    detail: `${receivables.overdueShare} of outstanding`,
                  },
                  { label: 'Not yet due', value: receivables.notYetDue },
                  { label: 'No due date', value: receivables.noDueDate },
                ]}
              />
              <AgingChart buckets={receivables.buckets} height={260} />
              <Legend
                items={receivables.buckets.map((bucket) => ({
                  label: bucket.label,
                  color: AGING_TONE[bucket.tone],
                  value: bucket.display,
                }))}
              />
            </>
          ) : (
            <NotReady state={receivables} empty="Nothing outstanding" />
          )}
          <BasedOn text={receivables.basedOn} />
        </Surface>
      </Panel>

      {receivables.status === 'ready' && receivables.customers.length > 0 ? (
        <Panel
          title="Overdue customers"
          action={
            <CsvButton
              name="Overdue customers"
              rangeLabel={asOfToday()}
              columns={OVERDUE_COLUMNS}
              rows={receivables.customers}
            />
          }
          description="Customers with overdue invoices, largest balance first"
        >
          <Surface>
            <DetailTable<OverdueCustomerRow>
              compact
              label="Overdue customers"
              noun="customers"
              rows={receivables.customers}
              {...(receivables.onOpenCustomer
                ? { onRowClick: (row: OverdueCustomerRow) => receivables.onOpenCustomer?.(row.id) }
                : {})}
              columns={[
                {
                  key: 'name',
                  header: 'Customer',
                  width: 220,
                  sortBy: (row) => row.name,
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  key: 'invoices',
                  header: 'Overdue invoices',
                  sortBy: (row) => row.invoices ?? -1,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">
                      {row.invoices ?? '—'}
                    </span>
                  ),
                },
                {
                  key: 'overdue',
                  header: 'Overdue',
                  sortBy: (row) => row.overdue,
                  cell: (row) => <span className="tabular-nums">{row.display.overdue}</span>,
                },
                {
                  key: 'outstanding',
                  header: 'Outstanding',
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">
                      {row.display.outstanding}
                    </span>
                  ),
                },
                {
                  key: 'oldest',
                  header: 'Oldest due',
                  sortBy: (row) => row.oldestDays,
                  cell: (row) => (
                    <span className="text-muted-foreground">{agingOf(row.oldestDays)}</span>
                  ),
                },
              ]}
            />
          </Surface>
        </Panel>
      ) : null}
    </div>
  )
}

function PaymentsTab(props: RevenueReportProps) {
  const { payments, comparing, rangeLabel } = props
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Days to pay"
        action={
          <CsvButton
            name="Days to pay"
            rangeLabel={rangeLabel}
            columns={DAYS_COLUMNS}
            rows={payments.status === 'ready' ? payments.series : []}
          />
        }
        description="Days from issuing an invoice to the payment that settled it, for payments in the period"
      >
        <Surface>
          {payments.status === 'ready' ? (
            <>
              <OverviewTiles
                variant="flush"
                tiles={[
                  tile('Average', payments.average, comparing),
                  { label: 'Median', value: payments.median },
                  {
                    label: 'Paid invoices',
                    value: payments.paidCount === undefined ? '—' : String(payments.paidCount),
                  },
                  { label: 'Paid within a week', value: payments.withinWeek },
                ]}
              />
              {daysHaveData(payments.series) ? (
                <DaysChart series={payments.series} height={260} />
              ) : (
                <NoChartData title="No payments in this range" />
              )}
            </>
          ) : (
            <NotReady state={payments} empty="No payments in this range" />
          )}
          <BasedOn text={payments.basedOn} />
        </Surface>
      </Panel>

      {payments.status === 'ready' && payments.payers.length > 0 ? (
        <Panel
          title="Payments by customer"
          action={
            <CsvButton
              name="Payments by customer"
              rangeLabel={rangeLabel}
              columns={PAYER_COLUMNS}
              rows={payments.payers}
            />
          }
          description="Paid invoices, amount collected and average days to pay, slowest first"
        >
          <Surface>
            <DetailTable<PayerRow>
              compact
              label="Payments by customer"
              noun="customers"
              rows={payments.payers}
              {...(payments.onOpenCustomer
                ? { onRowClick: (row: PayerRow) => payments.onOpenCustomer?.(row.id) }
                : {})}
              columns={[
                {
                  key: 'name',
                  header: 'Customer',
                  width: 240,
                  sortBy: (row) => row.name,
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  key: 'paid',
                  header: 'Paid invoices',
                  sortBy: (row) => row.paid ?? -1,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">{row.paid ?? '—'}</span>
                  ),
                },
                {
                  key: 'collected',
                  header: 'Collected',
                  cell: (row) => <span className="tabular-nums">{row.collected ?? '—'}</span>,
                },
                {
                  key: 'days',
                  header: 'Average days to pay',
                  sortBy: (row) => row.averageDays,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">
                      {row.averageDays} days
                    </span>
                  ),
                },
              ]}
            />
          </Surface>
        </Panel>
      ) : null}
    </div>
  )
}

function UsageTab(props: RevenueReportProps) {
  const { usage, rangeLabel } = props
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Events volume"
        action={
          <CsvButton
            name="Events volume"
            rangeLabel={rangeLabel}
            columns={EVENTS_COLUMNS}
            rows={usage.status === 'ready' ? usage.series : []}
          />
        }
        description="Usage events ingested per day, across every feature"
      >
        <Surface>
          {usage.status === 'ready' ? (
            <>
              <OverviewTiles
                variant="flush"
                tiles={[
                  { label: 'Total events', value: usage.total },
                  { label: 'Daily average', value: usage.weeklyAverage },
                  { label: 'Peak day', value: usage.peak },
                ]}
              />
              {eventsHaveData(usage.series) ? (
                <EventsChart series={usage.series} height={260} />
              ) : (
                <NoChartData title="No events in this range" />
              )}
              <BasedOn text={usage.basedOn} />
            </>
          ) : (
            <NotReady state={usage} empty="No events in this range" />
          )}
        </Surface>
      </Panel>
    </div>
  )
}
