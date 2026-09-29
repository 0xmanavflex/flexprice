import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { money } from '@fp/domain'
import { Button } from '@ui/primitives/button'
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
import { Metric } from './Metric'
import { Money } from './Money'
import { provenance } from '@ui/provenance'

/**
 * Revenue — the report behind the overview's headline number.
 *
 * Where Home answers "how is billing going", this answers "where does the money
 * come from, and what does it cost to make". The same parts as the overview
 * (`Metric`, `Section`, the `Chart` primitive, `Table`, `Money`) so the two read
 * as one product: a KPI strip, the contract/usage mix month over month, revenue
 * by customer split the same way, and gross margin by feature once cost sheets
 * are in.
 *
 * Representative sample data, held here the way `DashboardHome` holds its own.
 * Each series maps to a query the app will own (revenue-by-period,
 * revenue-by-customer, margin-by-feature); wiring is swapping these constants for
 * props.
 */
export const RevenueDashboardProvenance = provenance({
  source: 'composition',
  composes: ['flexprice/Metric', 'flexprice/Money', 'ui/section', 'ui/chart', 'ui/table'],
  note: 'The Revenue report: KPI strip, contract/usage mix, revenue by customer, margin by feature. Sample data, ready to wire.',
})

interface MixPoint {
  month: string
  contract: number
  usage: number
}

const MIX: MixPoint[] = [
  { month: 'Apr', contract: 82000, usage: 24000 },
  { month: 'May', contract: 91000, usage: 29000 },
  { month: 'Jun', contract: 104000, usage: 38000 },
  { month: 'Jul', contract: 118000, usage: 44000 },
  { month: 'Aug', contract: 131000, usage: 56000 },
  { month: 'Sep', contract: 154000, usage: 68000 },
]

interface CustomerRevenue {
  name: string
  contract: string
  usage: string
  net: string
}

const BY_CUSTOMER: CustomerRevenue[] = [
  { name: 'Acme Robotics', contract: '52000.00', usage: '32200.00', net: '84200.00' },
  { name: 'Globex AI', contract: '28000.00', usage: '33800.00', net: '61800.00' },
  { name: 'Initech Cloud', contract: '31000.00', usage: '12100.00', net: '43100.00' },
  { name: 'Umbrella Health', contract: '26000.00', usage: '12900.00', net: '38900.00' },
  { name: 'Hooli Search', contract: '9500.00', usage: '22000.00', net: '31500.00' },
]

interface FeatureMargin {
  feature: string
  margin: number
}

const MARGIN_BY_FEATURE: FeatureMargin[] = [
  { feature: 'API Calls', margin: 82 },
  { feature: 'Storage', margin: 74 },
  { feature: 'Compute Minutes', margin: 61 },
  { feature: 'AI Tokens', margin: 48 },
  { feature: 'Documents Processed', margin: 39 },
]

const mixConfig = {
  contract: { label: 'Contract', color: 'var(--chart-1)' },
  usage: { label: 'Usage', color: 'var(--chart-2)' },
} satisfies ChartConfig

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export interface RevenueDashboardProps {
  /** Where a link on the report leads. No-op by default, so it renders in isolation. */
  onNavigate?: (path: string) => void
}

export function RevenueDashboard({ onNavigate }: RevenueDashboardProps) {
  const go = (path: string) => onNavigate?.(path)

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Net revenue"
          value={<Money value={money('482900.00', 'USD')} />}
          hint="This quarter, net of credits"
          change={{ label: '12.4%', direction: 'up', sentiment: 'positive' }}
        />
        <Metric
          label="Contract revenue"
          value={<Money value={money('298600.00', 'USD')} />}
          hint="Recurring plan fees"
          change={{ label: '8.0%', direction: 'up', sentiment: 'positive' }}
        />
        <Metric
          label="Usage revenue"
          value={<Money value={money('184300.00', 'USD')} />}
          hint="Metered charges"
          change={{ label: '22%', direction: 'up', sentiment: 'positive' }}
        />
        <Metric
          label="Gross margin"
          value="68%"
          hint="After provider costs"
          change={{ label: '3.1 pts', direction: 'up', sentiment: 'positive' }}
        />
      </div>

      {/* Contract vs usage, month over month. */}
      <Section title="Revenue mix" description="Contract and usage revenue, last 6 months.">
        <ChartContainer config={mixConfig} className="aspect-auto h-[260px] w-full">
          <BarChart accessibilityLayer data={MIX} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
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
            <Bar dataKey="contract" stackId="rev" fill="var(--color-contract)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="usage" stackId="rev" fill="var(--color-usage)" radius={[4, 4, 0, 0]} />
          </BarChart>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Revenue by customer"
          description="Net revenue, split into contract and usage."
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
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BY_CUSTOMER.map((customer) => (
                <TableRow key={customer.name}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Money value={money(customer.contract, 'USD')} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Money value={money(customer.usage, 'USD')} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={money(customer.net, 'USD')} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section
          title="Gross margin by feature"
          description="Revenue after the cost of serving each metered feature."
          actions={
            <Button variant="ghost" size="sm" onClick={() => go('/cost-sheets')}>
              Cost sheets
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {MARGIN_BY_FEATURE.map((entry) => (
              <li key={entry.feature} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{entry.feature}</span>
                  <span className="tabular-nums text-muted-foreground">{entry.margin}%</span>
                </div>
                <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${entry.margin}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
