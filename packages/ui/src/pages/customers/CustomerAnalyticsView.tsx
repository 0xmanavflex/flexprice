import { useState } from 'react'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Section } from '../../compositions'
import { Properties, SegmentMeter, SimpleTable } from '../../compositions/DetailKit'

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

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function CustomerAnalyticsView({ features, query, onQueryChange }: CustomerAnalyticsViewProps) {
  const [local, setLocal] = useState<AnalyticsQuery>({ from: '2026-05-01', to: '2026-05-31', includeChildren: false })
  const current = query ?? local
  const change = (next: AnalyticsQuery) => (onQueryChange ? onQueryChange(next) : setLocal(next))
  const revenue = features.reduce((s, f) => s + f.revenue, 0)
  const cost = features.reduce((s, f) => s + f.cost, 0)
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" value={current.from} onChange={(e) => change({ ...current, from: e.target.value })} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" value={current.to} onChange={(e) => change({ ...current, to: e.target.value })} className="w-40" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Switch
            checked={current.includeChildren}
            onCheckedChange={(includeChildren) => change({ ...current, includeChildren })}
            aria-label="Include children"
          />
          Include children
        </label>
      </div>

      <Section title="Margin">
        <Properties
          columns={4}
          items={[
            { label: 'Revenue', value: usd(revenue) },
            { label: 'Cost', value: usd(cost) },
            { label: 'Margin', value: usd(margin) },
            { label: 'Margin %', value: `${pct.toFixed(1)}%` },
          ]}
        />
      </Section>

      <Section title="Share of revenue">
        <SegmentMeter
          segments={features.map((f) => ({
            id: f.id,
            label: f.name,
            share: revenue > 0 ? (f.revenue / revenue) * 100 : 0,
          }))}
        />
      </Section>

      <Section title="Usage breakdown">
        <SimpleTable
          rows={features}
          getRowId={(f) => f.id}
          columns={[
            { key: 'n', header: 'Feature', cell: (f) => f.name },
            { key: 'u', header: 'Usage', cell: (f) => f.usage },
            { key: 'r', header: 'Revenue', cell: (f) => usd(f.revenue) },
            { key: 'c', header: 'Cost', cell: (f) => usd(f.cost) },
            { key: 's', header: 'Share', cell: (f) => `${revenue > 0 ? ((f.revenue / revenue) * 100).toFixed(0) : 0}%` },
          ]}
        />
      </Section>
    </div>
  )
}

export const DEMO_FEATURE_ANALYTICS: FeatureAnalytics[] = [
  { id: 'f1', name: 'API requests', usage: '1,204,000', revenue: 120.4, cost: 31.2 },
  { id: 'f2', name: 'Seats', usage: '12', revenue: 120, cost: 0 },
  { id: 'f3', name: 'Storage (GB)', usage: '480', revenue: 48, cost: 14.4 },
]
