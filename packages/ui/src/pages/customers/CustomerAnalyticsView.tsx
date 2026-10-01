import { useState } from 'react'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@ui/components/primitives/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/components/primitives/table'
import { cn } from '@ui/lib/cn'
import { ChartBox } from '../../compositions/ChartBox'

export interface FeatureAnalytics {
  id: string
  name: string
  usage: string
  /** Compact total for the chart tabs, e.g. `120K`. */
  short?: string
  /** The unit of usage, e.g. `calls`. */
  unit?: string
  revenue: number
  cost: number
}

export interface AnalyticsQuery {
  from: string
  to: string
  includeChildren: boolean
}

export interface CustomerAnalyticsViewProps {
  features: FeatureAnalytics[]
  query?: AnalyticsQuery
  onQueryChange?: (query: AnalyticsQuery) => void
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function CustomerAnalyticsView({
  features,
  query,
  onQueryChange,
}: CustomerAnalyticsViewProps) {
  const [local, setLocal] = useState<AnalyticsQuery>({
    from: '2026-09-01',
    to: '2026-09-30',
    includeChildren: false,
  })
  const current = query ?? local
  const change = (next: AnalyticsQuery) => (onQueryChange ? onQueryChange(next) : setLocal(next))
  const [featureId, setFeatureId] = useState('all')
  const visible = featureId === 'all' ? features : features.filter((f) => f.id === featureId)
  const revenue = visible.reduce((s, f) => s + f.revenue, 0)
  const cost = visible.reduce((s, f) => s + f.cost, 0)
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : 0
  const [chartFeature, setChartFeature] = useState(features[0]?.id ?? '')
  const series = seriesFor(features.find((f) => f.id === chartFeature) ?? features[0])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={featureId} onValueChange={(value) => value !== null && setFeatureId(value)}>
          <SelectTrigger className="h-9 w-44" aria-label="Features">
            <SelectValue>
              {(value) =>
                value === 'all'
                  ? `${features.length} features`
                  : (features.find((f) => f.id === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">{features.length} features</SelectItem>
            {features.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          From
          <Input
            type="date"
            value={current.from}
            onChange={(e) => change({ ...current, from: e.target.value })}
            className="h-9 w-40"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          To
          <Input
            type="date"
            value={current.to}
            onChange={(e) => change({ ...current, to: e.target.value })}
            className="h-9 w-40"
          />
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch
            checked={current.includeChildren}
            onCheckedChange={(includeChildren) => change({ ...current, includeChildren })}
            aria-label="Include children"
          />
          Include children
        </label>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <dl className="grid grid-cols-2 divide-x lg:grid-cols-4">
          {[
            ['Revenue', usd(revenue)],
            ['Cost', usd(cost)],
            ['Margin', usd(margin)],
            ['Margin %', `${pct.toFixed(0)}%`],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1.5 p-6">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-xl font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ChartBox innerClassName="p-0 overflow-hidden">
        <div role="tablist" aria-label="Feature" className="flex divide-x border-b">
          {features.map((f) => {
            const active = f.id === chartFeature
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setChartFeature(f.id)}
                className={cn(
                  'flex flex-1 flex-col gap-1 border-b-2 px-5 py-4 text-left text-xs',
                  active ? 'border-foreground' : 'text-muted-foreground border-transparent',
                )}
              >
                <span>{f.name}</span>
                <span className="text-foreground text-base font-medium tabular-nums">
                  {f.short ?? f.usage}{' '}
                  {f.unit ? (
                    <span className="text-muted-foreground text-xs font-normal">{f.unit}</span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-5">
          <p className="text-muted-foreground mb-2 flex justify-end gap-3 text-xs tabular-nums">
            <span>
              Min <span className="text-foreground">{fmtK(Math.min(...series.map((d) => d.usage)))}</span>
            </span>
            <span>
              Max <span className="text-foreground">{fmtK(Math.max(...series.map((d) => d.usage)))}</span>
            </span>
          </p>
          <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
            <AreaChart data={series} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="usage"
                type="monotone"
                stroke="var(--color-usage)"
                fill="var(--color-usage)"
                fillOpacity={0.08}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </ChartBox>

      <section aria-labelledby="usage-breakdown" className="bg-card overflow-hidden rounded-xl border">
        <header className="flex flex-col gap-1 p-6">
          <h2 id="usage-breakdown" className="text-sm font-medium">
            Usage breakdown
          </h2>
          <p className="text-muted-foreground text-xs">
            {current.from} to {current.to}
          </p>
        </header>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {['Feature', 'Usage', 'Revenue', 'Cost', 'Share of revenue'].map((h, i) => (
                <TableHead
                  key={h}
                  className={cn(
                    'text-muted-foreground h-10 text-[11px] font-medium tracking-[0.08em] uppercase',
                    i === 0 && 'pl-6',
                  )}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((f) => {
              const share = revenue > 0 ? (f.revenue / revenue) * 100 : 0
              const ticks = Math.round((share / 100) * 24)
              return (
                <TableRow key={f.id} className="h-14 tabular-nums">
                  <TableCell className="pl-6 font-medium">{f.name}</TableCell>
                  <TableCell>
                    {f.usage} <span className="text-muted-foreground">{f.unit}</span>
                  </TableCell>
                  <TableCell>{usd(f.revenue)}</TableCell>
                  <TableCell className="text-muted-foreground">{usd(f.cost)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex h-4 w-40 items-stretch gap-[2px]">
                        {Array.from({ length: 24 }, (_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'flex-1 rounded-full',
                              i < ticks ? 'bg-primary' : 'bg-muted-foreground/15',
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-muted-foreground text-xs">{share.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}

const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

const CHART_CONFIG = { usage: { label: 'Usage', color: 'var(--chart-1)' } } satisfies ChartConfig

/** Demo daily series, shaped from the feature's id so each tab differs. */
function seriesFor(feature: FeatureAnalytics | undefined) {
  const seed = (feature?.id ?? 'x').charCodeAt(feature ? feature.id.length - 1 : 0)
  return Array.from({ length: 14 }, (_, i) => ({
    day: `Sep ${i + 1}`,
    usage: Math.round(40 + 30 * Math.sin((i + seed) / 2) + i * 4),
  }))
}

export const DEMO_FEATURE_ANALYTICS: FeatureAnalytics[] = [
  { id: 'f1', name: 'API Calls', usage: '120,000', short: '120K', unit: 'calls', revenue: 240, cost: 100.8 },
  { id: 'f2', name: 'AI Tokens', usage: '203,000', short: '203K', unit: 'tokens', revenue: 609, cost: 371.49 },
  { id: 'f3', name: 'Video Minutes', usage: '286,000', short: '286K', unit: 'minutes', revenue: 1144, cost: 515.2 },
  { id: 'f4', name: 'Compute Minutes', usage: '369,000', short: '369K', unit: 'minutes', revenue: 922.5, cost: 346.45 },
]
