import { useState } from 'react'
import { CalendarIcon, ChevronDownIcon, LayersIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Input } from '@ui/components/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { Switch } from '@ui/components/primitives/switch'
import { SegmentMeter } from '@ui/compositions/DetailKit'
import { Section } from '@ui/compositions/Section'
import { MetricChart } from '../shared/charts'
import { DetailTable } from '../shared/DetailTable'

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

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
)

/** Demo daily series, shaped from the feature's id so each tab differs. */
function seriesFor(feature: FeatureAnalytics) {
  const seed = feature.id.charCodeAt(feature.id.length - 1)
  return Array.from({ length: 14 }, (_, i) => ({
    label: `Sep ${i + 1}`,
    value: Math.round(40 + 30 * Math.sin((i + seed) / 2) + i * 4),
  }))
}

/** A date range end: shows the date, edits it in a popover. */
function DateButton({
  label,
  value,
  onChange,
  icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  icon?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 px-3" />}>
        {icon ? <CalendarIcon aria-hidden="true" /> : null}
        {label} {value}
        <ChevronDownIcon className="opacity-50" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2">
        <Input
          type="date"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8"
        />
      </PopoverContent>
    </Popover>
  )
}

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

  const [selected, setSelected] = useState<string[] | null>(null)
  const chosen = selected ?? features.map((f) => f.id)
  const visible = features.filter((f) => chosen.includes(f.id))
  const revenue = visible.reduce((s, f) => s + f.revenue, 0)
  const cost = visible.reduce((s, f) => s + f.cost, 0)
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : 0
  const [activeTab, setActiveTab] = useState('')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 px-3" aria-label="Features" />
            }
          >
            <LayersIcon aria-hidden="true" />
            {chosen.length === features.length ? 'All features' : `${chosen.length} features`}
            <ChevronDownIcon className="opacity-50" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Metered features
              </DropdownMenuLabel>
              {features.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.id}
                  closeOnClick={false}
                  checked={chosen.includes(f.id)}
                  onCheckedChange={(on) =>
                    setSelected(
                      on
                        ? [...chosen, f.id]
                        : chosen.length > 1
                          ? chosen.filter((id) => id !== f.id)
                          : chosen,
                    )
                  }
                >
                  {f.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DateButton
          icon
          label="From"
          value={current.from}
          onChange={(from) => change({ ...current, from })}
        />
        <DateButton label="To" value={current.to} onChange={(to) => change({ ...current, to })} />
        <label className="text-muted-foreground ml-auto flex items-center gap-2 text-[13px]">
          Include children
          <Switch
            checked={current.includeChildren}
            onCheckedChange={(includeChildren) => change({ ...current, includeChildren })}
            aria-label="Include children"
          />
        </label>
      </div>

      <dl className="bg-background grid grid-cols-2 divide-x rounded-xl border sm:grid-cols-4">
        {[
          ['Revenue', usd(revenue)],
          ['Cost', usd(cost)],
          ['Margin', usd(margin)],
          ['Margin %', `${pct.toFixed(0)}%`],
        ].map(([label, value]) => (
          <div key={label} className="px-6 py-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {visible.length > 0 ? (
        <MetricChart
          tabs={visible.map((f) => ({
            id: f.id,
            label: f.name,
            value: (
              <>
                {f.short ?? f.usage}
                {f.unit ? <span className="text-muted-foreground text-xs"> {f.unit}</span> : null}
              </>
            ),
            points: seriesFor(f),
          }))}
          activeTab={visible.some((f) => f.id === activeTab) ? activeTab : (visible[0]?.id ?? '')}
          onTabChange={setActiveTab}
          caption={`${current.from} to ${current.to}`}
        />
      ) : null}

      <Section title="Usage breakdown" flush bare>
        <DetailTable
          label="Usage breakdown"
          noun="features"
          rows={visible}
          getRowId={(f) => f.id}
          columns={[
            {
              key: 'name',
              header: 'Feature',
              cell: (f) => <span className="font-medium">{f.name}</span>,
            },
            {
              key: 'usage',
              header: 'Usage',
              cell: (f) => (
                <span className="tabular-nums">
                  {f.usage} {f.unit ? <Muted>{f.unit}</Muted> : null}
                </span>
              ),
            },
            {
              key: 'revenue',
              header: 'Revenue',
              cell: (f) => <span className="tabular-nums">{usd(f.revenue)}</span>,
            },
            { key: 'cost', header: 'Cost', cell: (f) => <Muted>{usd(f.cost)}</Muted> },
            {
              key: 'share',
              header: 'Share of revenue',
              cell: (f) => {
                const share = revenue > 0 ? f.revenue / revenue : 0
                return (
                  <span className="flex items-center gap-3">
                    <SegmentMeter value={share} segments={24} className="h-4 w-40" />
                    <Muted>{Math.round(share * 100)}%</Muted>
                  </span>
                )
              },
            },
          ]}
        />
      </Section>
    </div>
  )
}

export const DEMO_FEATURE_ANALYTICS: FeatureAnalytics[] = [
  {
    id: 'f1',
    name: 'API Calls',
    usage: '120,000',
    short: '120K',
    unit: 'calls',
    revenue: 240,
    cost: 100.8,
  },
  {
    id: 'f2',
    name: 'AI Tokens',
    usage: '203,000',
    short: '203K',
    unit: 'tokens',
    revenue: 609,
    cost: 371.49,
  },
  {
    id: 'f3',
    name: 'Video Minutes',
    usage: '286,000',
    short: '286K',
    unit: 'minutes',
    revenue: 1144,
    cost: 515.2,
  },
  {
    id: 'f4',
    name: 'Compute Minutes',
    usage: '369,000',
    short: '369K',
    unit: 'minutes',
    revenue: 922.5,
    cost: 346.45,
  },
]
