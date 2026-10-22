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
import { CalendarIcon } from '@ui/icons'
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
  invoices: number
  overdue: number
  display: { overdue: string; outstanding: string }
  oldestDays: number
}

export interface PayerRow {
  id: string
  name: string
  paid: number
  collected: string
  averageDays: number
}

export interface RevenueReportProps {
  title?: string
  filters: {
    range: string
    rangeOptions: FilterOption[]
    onRangeChange: (range: string) => void
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
    /** `month`, `week` or `day` — what one bar is. */
    grain: string
    series: RevenuePoint[]
  }

  customers: ReportState & {
    rows: CustomerRevenueRow[]
    billed: number
    arpu: ReportFigure
    topTenShare: string
    onOpenCustomer?: ((id: string) => void) | undefined
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
    paidCount: number
    withinWeek: string
    series: { label: string; days: number }[]
    payers: PayerRow[]
    onOpenCustomer?: ((id: string) => void) | undefined
  }

  usage: ReportState & {
    series: { label: string; events: number }[]
    total: string
    weeklyAverage: string
    peak: string
    /** Why wallet credits are not reported here. */
    creditsReason: string
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
  series: { label: string; days: number }[]
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
      <h2 className="sr-only">{TABS.find((tab) => tab.value === view)?.label ?? 'Overview'} report</h2>
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

function OverviewTab({
  revenue,
  receivables,
  payments,
  customers,
  usage,
  comparing,
  rangeLabel,
  onViewChange,
}: RevenueReportProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Revenue over time"
        description={`Invoiced revenue per ${revenue.grain}, ${rangeLabel}`}
        action={<ViewReport onClick={() => onViewChange('revenue')} />}
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
            <NotReady state={revenue} empty="No revenue in this range" />
          )}
          <BasedOn text={revenue.basedOn} />
        </Surface>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Receivables aging"
          description="Unpaid balance by days past due, as of today"
          action={<ViewReport onClick={() => onViewChange('receivables')} />}
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
          action={<ViewReport onClick={() => onViewChange('payments')} />}
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
                <DaysChart series={payments.series} />
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
          action={<ViewReport onClick={() => onViewChange('customers')} />}
        >
          <Surface>
            {customers.status === 'ready' ? (
              <>
                <CustomerBars rows={customers.rows.slice(0, 5)} height={236} />
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
          action={<ViewReport onClick={() => onViewChange('usage')} />}
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
                <EventsChart series={usage.series} height={220} />
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

function RevenueTab({ revenue, comparing, rangeLabel }: RevenueReportProps) {
  return (
    <Panel
      title="Revenue over time"
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
            <RevenueChart series={revenue.series} comparing={comparing} formatAxis={axisMoney} />
            <Legend
              items={[
                { label: 'Revenue', color: REVENUE },
                ...(comparing ? [{ label: 'Previous period', color: PREVIOUS, dashed: true }] : []),
              ]}
            />
          </>
        ) : (
          <NotReady state={revenue} height={320} empty="No revenue in this range" />
        )}
        <BasedOn text={revenue.basedOn} />
      </Surface>
    </Panel>
  )
}

function CustomersTab({ customers, comparing, rangeLabel }: RevenueReportProps) {
  const top = customers.rows.slice(0, 10)
  const largest = customers.rows[0]
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Top 10 customers"
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
              <CustomerBars rows={top} height={Math.max(160, top.length * 32 + 20)} />
              <Legend
                items={[
                  { label: 'Usage', color: USAGE_TONE },
                  { label: 'Contract', color: CONTRACT_TONE },
                ]}
              />
            </>
          ) : (
            <NotReady state={customers} height={330} empty="No billed customers in this range" />
          )}
        </Surface>
      </Panel>

      {customers.status === 'ready' && customers.rows.length > 0 ? (
        <Panel
          title="All customers"
          description="Revenue per customer in the period, highest first"
        >
          <Surface>
            <DetailTable<CustomerRevenueRow & { rank: number }>
              compact
              label="Customers by revenue"
              noun="customers"
              rows={customers.rows.map((row, index) => ({ ...row, rank: index + 1 }))}
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
                  sortBy: (row) => row.name,
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  sortBy: (row) => row.revenue,
                  cell: (row) => <span className="tabular-nums">{row.display.revenue}</span>,
                },
                {
                  key: 'contract',
                  header: 'Contract',
                  sortBy: (row) => row.contract,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">
                      {row.display.contract}
                    </span>
                  ),
                },
                {
                  key: 'usage',
                  header: 'Usage',
                  sortBy: (row) => row.usage,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">{row.display.usage}</span>
                  ),
                },
                {
                  key: 'share',
                  header: 'Share of total',
                  sortBy: (row) => row.share,
                  cell: (row) => <ShareBar value={row.share} color={REVENUE} />,
                },
              ]}
            />
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
                  sortBy: (row) => row.invoices,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">{row.invoices}</span>
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

function PaymentsTab({ payments, comparing }: RevenueReportProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Days to pay"
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
                  { label: 'Paid invoices', value: String(payments.paidCount) },
                  { label: 'Paid within a week', value: payments.withinWeek },
                ]}
              />
              <DaysChart series={payments.series} height={260} />
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
                  sortBy: (row) => row.paid,
                  cell: (row) => (
                    <span className="text-muted-foreground tabular-nums">{row.paid}</span>
                  ),
                },
                {
                  key: 'collected',
                  header: 'Collected',
                  cell: (row) => <span className="tabular-nums">{row.collected}</span>,
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

function UsageTab({ usage }: RevenueReportProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Events volume"
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
              <EventsChart series={usage.series} height={260} />
            </>
          ) : (
            <NotReady state={usage} empty="No events in this range" />
          )}
        </Surface>
      </Panel>
      <Panel
        title="Credits consumed and topped up"
        description="Wallet credits added, and credits applied to invoices"
      >
        <Surface>
          <SectionEmpty
            scene="billing"
            title="Not available yet"
            description={usage.creditsReason}
          />
        </Surface>
      </Panel>
    </div>
  )
}
