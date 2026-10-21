import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  PORTAL_RANGES,
  type PortalQuota,
  type PortalRange,
  type PortalSpend,
  type PortalSpendItem,
  dailyAverage,
  portalRangeWindow,
} from '@fp/domain'
import { ChevronDownIcon, ChevronRightIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@ui/components/primitives/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { type SimpleColumn, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { MeterTrack, filledSegments } from '../shared/SegmentMeter'
import { toneColor } from '../shared/charts'
import {
  formatChartMoney,
  formatUnitPrice,
  formatCompact,
  formatDate,
  formatDay,
  formatNumber,
  formatPercent,
} from './format'
import { FigureTile, FigureTileSkeleton, Loaded, PortalCard, PortalEmpty } from './parts'
import type { CustomerPortalData } from './types'

/**
 * What usage costs: a range, three figures, the trend, allowances used this
 * period, and a breakdown by feature.
 */
export const PortalUsageProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/tabs',
    'primitives/chart',
    'primitives/select',
    'compositions/detail/DetailKit',
    'shared/SegmentMeter',
    'shared/Money',
  ],
  note: 'Customer portal usage, after the reference portal: range chips, spend tiles, trend area chart, quota meters, breakdown table.',
})

export interface PortalUsageProps {
  data: CustomerPortalData
  range: PortalRange
  onRangeChange: (range: PortalRange) => void
  now: Date
  locale: string | undefined
}

export function PortalUsage({ data, range, onRangeChange, now, locale }: PortalUsageProps) {
  const period = portalRangeWindow(range, now)
  const last = new Date(period.end.getTime() - 1)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={range} onValueChange={(value) => onRangeChange(value as PortalRange)}>
          <TabsList aria-label="Period">
            {PORTAL_RANGES.map((r) => (
              <TabsTrigger key={r.id} value={r.id}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-muted-foreground text-sm tabular-nums">
          {period.days === 1
            ? formatDate(period.start, locale)
            : `${formatDate(period.start, locale)} – ${formatDate(last, locale)}`}
        </p>
      </div>
      <SpendTiles spend={data.spend} days={period.days} range={range} locale={locale} />
      <p className="text-muted-foreground -mt-2 text-[13px]">
        Spend is what usage adds to your next invoice, before credits and tax.
      </p>
      <Trend spend={data.spend} hourly={period.days === 1} locale={locale} />
      <Quotas quotas={data.quotas} locale={locale} />
      <Breakdown spend={data.spend} locale={locale} />
    </>
  )
}

const RANGE_CAPTION: Record<PortalRange, string> = {
  today: 'today',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  'this-month': 'this month',
  'last-month': 'last month',
}

function SpendTiles({
  spend,
  days,
  range,
  locale,
}: {
  spend: CustomerPortalData['spend']
  days: number
  range: PortalRange
  locale: string | undefined
}) {
  const money = (value: PortalSpend['total']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const tiles =
    spend.status !== 'ready'
      ? null
      : (() => {
          const top = spend.data.items[0]
          return (
            <>
              <FigureTile
                label="Spend"
                caption={`Usage charges, ${RANGE_CAPTION[range]}`}
                value={money(spend.data.total)}
              />
              <FigureTile
                label="Largest cost"
                caption={
                  top
                    ? `${top.name} · ${formatPercent(top.share, locale)} of spend`
                    : 'No usage yet'
                }
                value={top ? money(top.cost) : '—'}
              />
              <FigureTile
                label="Daily average"
                caption="Spend per day in this period"
                value={money(dailyAverage(spend.data.total, days))}
              />
            </>
          )
        })()
  return (
    <div className="bg-card grid overflow-hidden rounded-xl border max-sm:divide-y sm:grid-cols-3 sm:divide-x">
      {tiles ?? (
        <>
          <FigureTileSkeleton />
          <FigureTileSkeleton />
          <FigureTileSkeleton />
        </>
      )}
    </div>
  )
}

const ALL = 'all'

function Trend({
  spend,
  hourly,
  locale,
}: {
  spend: CustomerPortalData['spend']
  hourly: boolean
  locale: string | undefined
}) {
  const [featureId, setFeatureId] = useState(ALL)
  const [measure, setMeasure] = useState<'cost' | 'usage'>('cost')
  const items = useMemo(() => (spend.status === 'ready' ? spend.data.items : []), [spend])
  const selected = items.find((i) => i.featureId === featureId) ?? null
  // Quantities of different features do not add up (calls and GB): quantity needs one feature.
  const effective = selected ? measure : 'cost'
  const currency = spend.status === 'ready' ? spend.data.currency : 'USD'

  const points = useMemo(() => {
    const source = selected ? [selected] : items
    const byTime = new Map<number, number>()
    for (const item of source) {
      for (const p of item.points) {
        byTime.set(
          p.at.getTime(),
          (byTime.get(p.at.getTime()) ?? 0) + (effective === 'cost' ? p.cost : p.usage),
        )
      }
    }
    return [...byTime.entries()]
      .sort(([a], [b]) => a - b)
      .map(([at, value]) => ({
        label: hourly
          ? new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(at)
          : formatDay(new Date(at), locale),
        value,
      }))
  }, [items, selected, effective, hourly, locale])

  const config: ChartConfig = {
    value: {
      label: effective === 'cost' ? 'Cost' : selected?.unit || 'Quantity',
      color: toneColor('series-1'),
    },
  }
  const format = (value: number) =>
    effective === 'cost' ? formatChartMoney(value, currency, locale) : formatCompact(value, locale)

  return (
    <PortalCard
      title="Usage trend"
      description={`${effective === 'cost' ? 'Cost' : 'Quantity'} per ${hourly ? 'hour' : 'day'} across ${selected ? selected.name : 'all features'}`}
      action={
        spend.status === 'ready' && items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={featureId}
              onValueChange={(value) => value !== null && setFeatureId(value)}
            >
              <SelectTrigger className="h-8 w-44" aria-label="Feature">
                <SelectValue>
                  {(value) =>
                    value === ALL ? 'All features' : items.find((i) => i.featureId === value)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL}>All features</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.featureId} value={i.featureId}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs
              value={effective}
              onValueChange={(value) => setMeasure(value as 'cost' | 'usage')}
            >
              <TabsList aria-label="Measure">
                <TabsTrigger value="cost">Cost</TabsTrigger>
                <TabsTrigger
                  value="usage"
                  disabled={!selected}
                  title={selected ? undefined : 'Pick a feature to see its quantity'}
                >
                  Quantity
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        ) : null
      }
    >
      <Loaded load={spend} label="usage" rows={1}>
        {(data) =>
          data.items.length === 0 || points.length === 0 ? (
            <PortalEmpty
              title="No usage in this period"
              description="Your usage and its cost appear here as soon as your apps send events."
            />
          ) : (
            <div className="flex flex-col gap-4 p-6">
              <p className="text-2xl font-medium tabular-nums">
                {effective === 'cost' ? (
                  <Money
                    value={selected ? selected.cost : data.total}
                    {...(locale ? { locale } : {})}
                  />
                ) : (
                  `${formatNumber(selected?.usage ?? '0', locale)} ${selected?.unit ?? ''}`
                )}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  in this period
                </span>
              </p>
              <ChartContainer config={config} className="aspect-auto h-64 w-full">
                <AreaChart data={points} margin={{ left: 4, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="portal-trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={format} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => format(Number(value))} />}
                  />
                  <Area
                    dataKey="value"
                    type="monotone"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    fill="url(#portal-trend-fill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )
        }
      </Loaded>
    </PortalCard>
  )
}

const SEGMENTS = 40

function Quotas({
  quotas,
  locale,
}: {
  quotas: CustomerPortalData['quotas']
  locale: string | undefined
}) {
  return (
    <PortalCard
      title="Usage quota"
      description="How much of each allowance you’ve used this billing period"
    >
      <Loaded load={quotas} label="allowances">
        {(rows) =>
          rows.length === 0 ? (
            <PortalEmpty
              title="No allowances"
              description="Your plan has no metered allowances, so there’s nothing to track here."
            />
          ) : (
            <ul className="divide-y">
              {rows.map((q) => (
                <QuotaRow key={q.featureId || q.name} quota={q} locale={locale} />
              ))}
            </ul>
          )
        }
      </Loaded>
    </PortalCard>
  )
}

function QuotaRow({ quota: q, locale }: { quota: PortalQuota; locale: string | undefined }) {
  const unit = q.unit ? ` ${q.unit}` : ''
  const filled = q.unlimited ? 0 : filledSegments(Number(q.used), Number(q.limit ?? 0), SEGMENTS)
  return (
    <li className="flex flex-col gap-2 px-6 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{q.name}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {q.unlimited
              ? `${formatCompact(q.used, locale)}${unit} · no limit`
              : `${formatCompact(q.used, locale)} of ${formatCompact(q.limit ?? '0', locale)}${unit}`}
          </p>
        </div>
        <p
          className={cn(
            'shrink-0 text-sm tabular-nums',
            q.over ? 'text-destructive-foreground dark:text-destructive' : '',
          )}
        >
          {q.unlimited ? 'Unlimited' : `${Math.round(q.percent)}% used`}
        </p>
      </div>
      {q.unlimited ? null : (
        <div aria-hidden="true">
          <MeterTrack filled={filled} segments={SEGMENTS} className="h-4" />
        </div>
      )}
      <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
        {q.over ? (
          <span className="text-destructive-foreground dark:text-destructive">
            {formatCompact(q.over, locale)} over · billed as usage
          </span>
        ) : (
          <span />
        )}
        {q.resetsAt ? <span>Resets {formatDate(q.resetsAt, locale)}</span> : null}
      </div>
    </li>
  )
}

function Breakdown({
  spend,
  locale,
}: {
  spend: CustomerPortalData['spend']
  locale: string | undefined
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  return (
    <PortalCard title="Usage breakdown" description="What each feature cost in this period">
      <Loaded load={spend} label="usage">
        {(data) => {
          if (data.items.length === 0) {
            return (
              <PortalEmpty
                title="No usage yet"
                description="Each feature’s usage and cost show up here."
              />
            )
          }
          const groups = groupItems(data.items)
          const money = (value: PortalSpendItem['cost']) => (
            <Money value={value} {...(locale ? { locale } : {})} />
          )
          const columns: SimpleColumn<PortalSpendItem>[] = [
            {
              key: 'feature',
              header: 'Feature',
              className: 'font-medium',
              cell: (item) => item.name,
            },
            {
              key: 'usage',
              header: 'Usage',
              className: 'w-44 text-right tabular-nums',
              cell: (item) => (
                <>
                  {formatNumber(item.usage, locale)}
                  {item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
                </>
              ),
            },
            {
              key: 'unit-cost',
              header: 'Unit cost',
              className: 'w-32 text-right',
              cell: (item) =>
                item.unitCost ? (
                  <span className="tabular-nums">
                    {formatUnitPrice(item.unitCost.amount, item.unitCost.currency, locale)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: 'cost',
              header: 'Cost',
              className: 'w-32 text-right',
              cell: (item) => money(item.cost),
            },
            {
              key: 'share',
              header: 'Share of spend',
              className: 'w-60',
              cell: (item) => (
                <div className="flex items-center gap-3">
                  <MeterTrack
                    filled={filledSegments(item.share, 1, 20)}
                    segments={20}
                    className="h-3"
                  />
                  <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
                    {formatPercent(item.share, locale)}
                  </span>
                </div>
              ),
            },
          ]
          return (
            <div className="divide-y">
              {groups.map(({ name, items }) => {
                const open = !name || !collapsed.has(name)
                return (
                  <div key={name ?? 'ungrouped'}>
                    {name ? (
                      <div className="bg-muted/30 px-4 py-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={open}
                          onClick={() =>
                            setCollapsed((prev) => {
                              const next = new Set(prev)
                              if (next.has(name)) next.delete(name)
                              else next.add(name)
                              return next
                            })
                          }
                        >
                          {open ? (
                            <ChevronDownIcon aria-hidden="true" />
                          ) : (
                            <ChevronRightIcon aria-hidden="true" />
                          )}
                          {name}
                          <span className="text-muted-foreground font-normal">{items.length}</span>
                        </Button>
                      </div>
                    ) : null}
                    {open ? (
                      <SimpleTable
                        rows={items}
                        getRowId={(item) => item.featureId}
                        columns={columns}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        }}
      </Loaded>
    </PortalCard>
  )
}

/** Features in their groups, largest group first; ungrouped features last, unheaded. */
function groupItems(items: PortalSpendItem[]): { name: string | null; items: PortalSpendItem[] }[] {
  const groups = new Map<string | null, PortalSpendItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  const named = [...groups.entries()].filter(([name]) => name !== null) as [
    string,
    PortalSpendItem[],
  ][]
  if (named.length === 0) return [{ name: null, items }]
  return [
    ...named.map(([name, rows]) => ({ name, items: rows })),
    ...(groups.has(null) ? [{ name: null, items: groups.get(null) ?? [] }] : []),
  ]
}
