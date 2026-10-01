import { useState } from 'react'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/primitives/card'
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
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'

export interface FeatureAnalytics {
  id: string
  name: string
  usage: string
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
    from: '2026-05-01',
    to: '2026-05-31',
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Revenue', usd(revenue)],
          ['Cost', usd(cost)],
          ['Margin', usd(margin)],
          ['Margin %', `${pct.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-card flex flex-col gap-1 rounded-xl border p-5">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-2xl font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      <Tabs value={chartFeature} onValueChange={(value) => setChartFeature(String(value))}>
        <Card className="gap-0 p-0 shadow-xs">
          <CardHeader className="flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
            <CardTitle className="text-sm font-medium">Usage over time</CardTitle>
            <TabsList>
              {features.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          <CardContent className="px-5 py-5">
            <ChartContainer config={CHART_CONFIG} className="h-56 w-full">
              <AreaChart data={series} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="usage"
                  type="monotone"
                  stroke="var(--color-usage)"
                  fill="var(--color-usage)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </Tabs>

      <Section
        title="Usage breakdown"
        description="What each feature used and earned in this range"
      >
        <SimpleTable
          rows={visible}
          getRowId={(f) => f.id}
          columns={[
            {
              key: 'n',
              header: 'Feature',
              cell: (f) => <span className="font-medium">{f.name}</span>,
            },
            { key: 'u', header: 'Usage', cell: (f) => f.usage },
            { key: 'r', header: 'Revenue', cell: (f) => usd(f.revenue) },
            { key: 'c', header: 'Cost', cell: (f) => usd(f.cost) },
            {
              key: 's',
              header: 'Share',
              cell: (f) => `${revenue > 0 ? ((f.revenue / revenue) * 100).toFixed(0) : 0}%`,
            },
          ]}
        />
      </Section>
    </div>
  )
}

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
  { id: 'f1', name: 'API requests', usage: '1,204,000', revenue: 120.4, cost: 31.2 },
  { id: 'f2', name: 'Seats', usage: '12', revenue: 120, cost: 0 },
  { id: 'f3', name: 'Storage (GB)', usage: '480', revenue: 48, cost: 14.4 },
]
