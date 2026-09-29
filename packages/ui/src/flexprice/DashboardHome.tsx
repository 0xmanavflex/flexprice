import { useState } from 'react'
import { ArrowUpRightIcon, ReceiptTextIcon } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { money } from '@fp/domain'
import { Button } from '@ui/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@ui/primitives/chart'
import type { ChartConfig } from '@ui/primitives/chart'
import { Section } from '@ui/compositions/Section'
import { EmptyState } from '@ui/compositions/EmptyState'
import { Metric } from './Metric'
import { Money } from './Money'
import { provenance } from '@ui/provenance'

/**
 * Home — the console's overview.
 *
 * Replaces the vendored ReUI sample block with a surface that speaks billing:
 * the numbers a founder opens the console to see (net revenue, margin, usage
 * revenue, live subscriptions), the shape of revenue over the period, who is
 * paying, and what is being metered. It is composed from the same parts every
 * other surface uses — `Metric`, `Section`, the `Chart` primitive, `Table`,
 * `Money` — so it inherits the design system rather than importing a second one.
 *
 * The data here is representative sample data, held in this module the way the
 * old block held its own. Each series maps one-to-one to a query the app will
 * own later (revenue-by-period, revenue-by-customer, usage-by-feature); wiring
 * it is swapping these constants for props, and the component already reads from
 * a `period`-keyed record so a real range picker drops straight in.
 */
export const DashboardHomeProvenance = provenance({
  source: 'composition',
  composes: ['flexprice/Metric', 'flexprice/Money', 'ui/section', 'ui/chart', 'ui/table'],
  note: 'The Home overview: KPI strip, revenue trend, revenue-by-customer, and metered usage. Sample data, ready to wire.',
})

type PeriodId = 'week' | 'month' | 'quarter'

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
]

interface Kpi {
  label: string
  value: React.ReactNode
  hint: string
  change: { label: string; direction: 'up' | 'down'; sentiment: 'positive' | 'negative' }
}

interface TrendPoint {
  label: string
  contract: number
  usage: number
}

interface PeriodData {
  kpis: Kpi[]
  trend: TrendPoint[]
}

/** One dataset per range, so the picker is a real interaction, not a label swap. */
const DATA: Record<PeriodId, PeriodData> = {
  week: {
    kpis: [
      {
        label: 'Net revenue',
        value: <Money value={money('38420.00', 'USD')} />,
        hint: 'Contract + usage, net of credits',
        change: { label: '4.1%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Gross margin',
        value: '67%',
        hint: 'After provider costs',
        change: { label: '1.2 pts', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Usage revenue',
        value: <Money value={money('14860.00', 'USD')} />,
        hint: 'Metered charges this period',
        change: { label: '8.0%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Active subscriptions',
        value: '1,284',
        hint: '12 new in the last 7 days',
        change: { label: '12', direction: 'up', sentiment: 'positive' },
      },
    ],
    trend: [
      { label: 'Mon', contract: 3200, usage: 1400 },
      { label: 'Tue', contract: 3300, usage: 1650 },
      { label: 'Wed', contract: 3150, usage: 1720 },
      { label: 'Thu', contract: 3600, usage: 2100 },
      { label: 'Fri', contract: 3550, usage: 2340 },
      { label: 'Sat', contract: 2900, usage: 1980 },
      { label: 'Sun', contract: 3050, usage: 2100 },
    ],
  },
  month: {
    kpis: [
      {
        label: 'Net revenue',
        value: <Money value={money('164300.00', 'USD')} />,
        hint: 'Contract + usage, net of credits',
        change: { label: '9.6%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Gross margin',
        value: '68%',
        hint: 'After provider costs',
        change: { label: '2.4 pts', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Usage revenue',
        value: <Money value={money('61200.00', 'USD')} />,
        hint: 'Metered charges this period',
        change: { label: '14%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Active subscriptions',
        value: '1,284',
        hint: '38 new this month',
        change: { label: '38', direction: 'up', sentiment: 'positive' },
      },
    ],
    trend: [
      { label: 'Wk 1', contract: 34000, usage: 12800 },
      { label: 'Wk 2', contract: 35200, usage: 14100 },
      { label: 'Wk 3', contract: 36800, usage: 15600 },
      { label: 'Wk 4', contract: 38100, usage: 18700 },
    ],
  },
  quarter: {
    kpis: [
      {
        label: 'Net revenue',
        value: <Money value={money('482900.00', 'USD')} />,
        hint: 'Contract + usage, net of credits',
        change: { label: '12.4%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Gross margin',
        value: '68%',
        hint: 'After provider costs',
        change: { label: '3.1 pts', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Usage revenue',
        value: <Money value={money('184300.00', 'USD')} />,
        hint: 'Metered charges this period',
        change: { label: '22%', direction: 'up', sentiment: 'positive' },
      },
      {
        label: 'Active subscriptions',
        value: '1,284',
        hint: '112 new this quarter',
        change: { label: '112', direction: 'up', sentiment: 'positive' },
      },
    ],
    trend: [
      { label: 'Jul', contract: 128000, usage: 42000 },
      { label: 'Aug', contract: 141000, usage: 56000 },
      { label: 'Sep', contract: 154000, usage: 68000 },
    ],
  },
}

interface CustomerRevenue {
  name: string
  plan: string
  net: string
}

/** Top accounts by net revenue — maps to a revenue-by-customer query. */
const TOP_CUSTOMERS: CustomerRevenue[] = [
  { name: 'Acme Robotics', plan: 'Growth', net: '84200.00' },
  { name: 'Globex AI', plan: 'Enterprise', net: '61800.00' },
  { name: 'Initech Cloud', plan: 'Growth', net: '43100.00' },
  { name: 'Umbrella Health', plan: 'Scale', net: '38900.00' },
  { name: 'Hooli Search', plan: 'Enterprise', net: '31500.00' },
]

interface PlanShare {
  plan: string
  count: number
}

/** Subscriptions created in the period, by plan. */
const SUBS_BY_PLAN: PlanShare[] = [
  { plan: 'Starter', count: 64 },
  { plan: 'Growth', count: 41 },
  { plan: 'Scale', count: 18 },
  { plan: 'Enterprise', count: 7 },
]

interface FeatureUsage {
  feature: string
  usage: number
  unit: string
}

/** Top metered features, last 7 days. */
const TOP_FEATURES: FeatureUsage[] = [
  { feature: 'API Calls', usage: 4_820_000, unit: 'calls' },
  { feature: 'AI Tokens', usage: 2_140_000, unit: 'tokens' },
  { feature: 'Compute Minutes', usage: 318_000, unit: 'min' },
  { feature: 'Storage', usage: 96_400, unit: 'GB' },
  { feature: 'Documents Processed', usage: 41_200, unit: 'docs' },
]

const trendConfig = {
  contract: { label: 'Contract', color: 'var(--chart-1)' },
  usage: { label: 'Usage', color: 'var(--chart-2)' },
} satisfies ChartConfig

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export interface DashboardHomeProps {
  /** Where a link on the overview leads. No-op by default, so the block renders in isolation. */
  onNavigate?: (path: string) => void
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [period, setPeriod] = useState<PeriodId>('quarter')
  const { kpis, trend } = DATA[period]
  const periodLabel = PERIODS.find((entry) => entry.id === period)?.label ?? ''

  const go = (path: string) => onNavigate?.(path)

  const subsTotal = SUBS_BY_PLAN.reduce((sum, entry) => sum + entry.count, 0)
  const featuresMax = Math.max(...TOP_FEATURES.map((entry) => entry.usage))

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-5 p-6">
      {/* A real heading for the surface, so the page has a title in the outline
          even though the visible one lives in the shell's breadcrumb. */}
      <h1 className="sr-only">Overview</h1>

      {/* The one control the overview owns: the range everything below reads. */}
      <div className="flex items-center justify-end">
        <Select value={period} onValueChange={(next) => setPeriod(next as PeriodId)}>
          <SelectTrigger aria-label="Period" className="h-8 w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {PERIODS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI strip. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Metric
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            change={{ ...kpi.change }}
          />
        ))}
      </div>

      {/* Revenue trend. */}
      <Section
        title="Revenue"
        description={`Contract and usage revenue, ${periodLabel.toLowerCase()}.`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => go('/revenue')}>
            View report
            <ArrowUpRightIcon aria-hidden />
          </Button>
        }
      >
        <ChartContainer config={trendConfig} className="aspect-auto h-[240px] w-full">
          <AreaChart accessibilityLayer data={trend} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground capitalize">{name}</span>
                      <span className="font-mono font-medium tabular-nums">
                        ${compact.format(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <defs>
              <linearGradient id="fill-contract" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-contract)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--color-contract)" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="fill-usage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-usage)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--color-usage)" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <Area
              dataKey="contract"
              type="natural"
              fill="url(#fill-contract)"
              stroke="var(--color-contract)"
              stackId="revenue"
            />
            <Area
              dataKey="usage"
              type="natural"
              fill="url(#fill-usage)"
              stroke="var(--color-usage)"
              stackId="revenue"
            />
          </AreaChart>
        </ChartContainer>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-[var(--chart-1)]" />
            Contract
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-[var(--chart-2)]" />
            Usage
          </span>
        </div>
      </Section>

      {/* Revenue by customer, and subscriptions by plan. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Revenue by customer"
          description="Top accounts by net revenue."
          actions={
            <Button variant="ghost" size="sm" onClick={() => go('/customers')}>
              View all
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Net revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOP_CUSTOMERS.map((customer) => (
                <TableRow key={customer.name}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.plan}</TableCell>
                  <TableCell className="text-right">
                    <Money value={money(customer.net, 'USD')} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section
          title="Subscriptions created"
          description={`New subscriptions ${periodLabel.toLowerCase()}, by plan.`}
          actions={
            <Button variant="ghost" size="sm" onClick={() => go('/subscriptions')}>
              View all
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {SUBS_BY_PLAN.map((entry) => (
              <li key={entry.plan} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{entry.plan}</span>
                  <span className="tabular-nums text-muted-foreground">{entry.count}</span>
                </div>
                <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${Math.round((entry.count / subsTotal) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Metered usage, and the cost-tracking nudge. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Top metered features"
          description="Metered usage per feature, last 7 days."
          actions={
            <Button variant="ghost" size="sm" onClick={() => go('/features')}>
              View all
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {TOP_FEATURES.map((entry) => (
              <li key={entry.feature} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{entry.feature}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {compact.format(entry.usage)} {entry.unit}
                  </span>
                </div>
                <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-2)]"
                    style={{ width: `${Math.round((entry.usage / featuresMax) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Track your costs"
          description="What each unit costs you, so gross margin shows up next to revenue."
        >
          <EmptyState
            size="inline"
            icon={<ReceiptTextIcon aria-hidden />}
            title="No cost sheets yet"
            description="Add provider costs per unit and Flexprice shows gross margin by feature and customer automatically."
            action={<Button onClick={() => go('/cost-sheets')}>Add cost sheet</Button>}
          />
        </Section>
      </div>
    </div>
  )
}
