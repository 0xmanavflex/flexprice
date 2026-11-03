import { type ReactNode, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  PORTAL_RANGES,
  type PortalQuota,
  type PortalRange,
  type PortalSpend,
  type PortalSpendItem,
  dailyAverage,
  portalRangeWindow,
  projectSpend,
  spendChange,
  unitPriceLabel,
} from '@fp/domain'
import {
  CalendarClockIcon,
  CalendarIcon,
  ChevronRightIcon,
  CoinsIcon,
  GaugeIcon,
  TrendingUpIcon,
} from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Calendar } from '@ui/components/primitives/calendar'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@ui/components/primitives/chart'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { IconTile } from '@ui/components/reui/icon-tile'
import { Section } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { MeterTrack, filledSegments } from '../shared/SegmentMeter'
import {
  formatChartMoney,
  formatCompact,
  formatDate,
  formatDay,
  formatNumber,
  formatPercent,
  formatUnitPrice,
} from './format'
import { Loaded, PortalEmpty } from './parts'
import type { CustomerPortalData } from './types'

/**
 * What usage costs, after the portal prototype (`portal/usage.tsx`): one range
 * for the whole page (presets or a calendar range), the spend summary, the
 * trend, allowances used this period, and a breakdown by feature group.
 */
export const PortalUsageProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/tabs',
    'primitives/calendar',
    'primitives/popover',
    'primitives/chart',
    'primitives/select',
    'reui/icon-tile',
    'compositions/layout/Section',
    'shared/SegmentMeter',
    'shared/Money',
  ],
  note: 'Customer portal usage, after the portal prototype: date controls, spend summary, usage trend, usage quota, usage breakdown.',
})

const DAY = 86_400_000

export interface PortalUsageProps {
  data: CustomerPortalData
  range: PortalRange
  customRange: { start: Date; end: Date } | null
  onRangeChange: (range: PortalRange) => void
  onCustomRange: (start: Date, end: Date) => void
  now: Date
  locale: string | undefined
}

export function PortalUsage(props: PortalUsageProps) {
  const { data, range, customRange, now, locale } = props
  const period = customRange
    ? {
        start: customRange.start,
        end: customRange.end,
        days: Math.max(
          1,
          Math.round((customRange.end.getTime() - customRange.start.getTime()) / DAY),
        ),
      }
    : portalRangeWindow(range, now)

  return (
    <div className="flex flex-col gap-5">
      <DateControls {...props} period={period} />
      <SpendSummary
        data={data}
        days={period.days}
        caption={customRange ? 'this period' : RANGE_CAPTION[range]}
        now={now}
        locale={locale}
      />
      <UsageTrend spend={data.spend} hourly={period.days === 1} locale={locale} />
      <Allowances quotas={data.quotas} locale={locale} />
      <Breakdown spend={data.spend} locale={locale} />
    </div>
  )
}

/* ---- Date controls ------------------------------------------------------- */

/** Preset control plus a calendar range, shared by every widget on the page. */
function DateControls({
  range,
  customRange,
  onRangeChange,
  onCustomRange,
  now,
  locale,
  period,
}: PortalUsageProps & { period: { start: Date; end: Date } }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>(undefined)
  const last = new Date(period.end.getTime() - 1)
  const oneDay = period.end.getTime() - period.start.getTime() <= DAY
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs
        value={customRange ? '' : range}
        onValueChange={(value) => {
          if (value) onRangeChange(value as PortalRange)
        }}
      >
        <TabsList aria-label="Period" className="bg-muted/60 h-9 rounded-lg p-1">
          {PORTAL_RANGES.map((r) => (
            <TabsTrigger key={r.id} value={r.id} className="h-7 px-3 text-[13px] font-normal">
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setDraft({ from: period.start, to: last })
        }}
      >
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 px-3 font-normal tabular-nums',
                customRange && 'border-primary/50',
              )}
              aria-label="Pick a date range"
            />
          }
        >
          <CalendarIcon aria-hidden="true" />
          {oneDay
            ? formatDate(period.start, locale)
            : `${formatDate(period.start, locale)} – ${formatDate(last, locale)}`}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            captionLayout="dropdown"
            numberOfMonths={2}
            selected={draft}
            defaultMonth={new Date(now.getFullYear(), now.getMonth() - 1, 1)}
            disabled={{ after: now }}
            onSelect={(next: DateRange | undefined) => {
              setDraft(next)
              if (next?.from && next.to && next.from.getTime() !== next.to.getTime()) {
                const start = new Date(
                  next.from.getFullYear(),
                  next.from.getMonth(),
                  next.from.getDate(),
                )
                const end = new Date(
                  next.to.getFullYear(),
                  next.to.getMonth(),
                  next.to.getDate() + 1,
                )
                onCustomRange(start, end)
                setOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* ---- Spend summary ------------------------------------------------------- */

const RANGE_CAPTION: Record<PortalRange, string> = {
  today: 'today',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  'this-month': 'this month',
  'last-month': 'last month',
}

interface Cell {
  icon: ReactNode
  title: string
  hint: ReactNode
  value: ReactNode | null
}

/**
 * Three figures every customer has, whatever they meter, from
 * `POST /analytics/revenue`: spend and its change against the window just
 * before; the largest cost and its share; and the daily average, with where
 * the billing period lands at that pace.
 */
function SpendSummary({
  data,
  days,
  caption,
  now,
  locale,
}: {
  data: CustomerPortalData
  days: number
  caption: string
  now: Date
  locale: string | undefined
}) {
  const money = (value: PortalSpend['total']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const dash = <span className="text-muted-foreground">—</span>

  let cells: Cell[]
  if (data.spend.status !== 'ready') {
    cells = [
      { icon: <CoinsIcon />, title: 'Spend', hint: ' ', value: null },
      { icon: <TrendingUpIcon />, title: 'Largest cost', hint: ' ', value: null },
      { icon: <CalendarClockIcon />, title: 'Daily average', hint: ' ', value: null },
    ]
  } else if (data.spend.data.items.length === 0) {
    cells = [
      {
        icon: <CoinsIcon />,
        title: 'Spend',
        hint: `No usage charges, ${caption}`,
        value: money(data.spend.data.total),
      },
      {
        icon: <TrendingUpIcon />,
        title: 'Largest cost',
        hint: 'Shows once a feature is used',
        value: dash,
      },
      {
        icon: <CalendarClockIcon />,
        title: 'Daily average',
        hint: 'Shows once there is usage',
        value: dash,
      },
    ]
  } else {
    const spend = data.spend.data
    const top = spend.items[0]
    const daily = dailyAverage(spend.total, days)
    const change =
      data.previousSpend.status === 'ready'
        ? spendChange(spend.total, data.previousSpend.data.total)
        : null
    const subscription =
      data.subscriptions.status === 'ready'
        ? data.subscriptions.data.find((s) => s.status === 'active' && s.periodEnd)
        : undefined
    const periodEnd = subscription?.periodEnd ?? null
    const soFar = data.periodSpend?.status === 'ready' ? data.periodSpend.data.total : null
    const daysLeft = periodEnd
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY))
      : 0
    const projected = periodEnd && soFar ? projectSpend(soFar, daily, daysLeft) : null
    cells = [
      {
        icon: <CoinsIcon />,
        title: 'Spend',
        hint:
          change === null ? (
            `Usage charges, ${caption}`
          ) : (
            <>
              <span
                className={cn(
                  'font-medium',
                  change > 0 ? 'text-foreground' : 'text-success-foreground dark:text-success',
                )}
              >
                {change > 0 ? '↑' : '↓'} {Math.abs(Math.round(change * 100))}%
              </span>{' '}
              vs the {days === 1 ? 'day' : `${days} days`} before
            </>
          ),
        value: money(spend.total),
      },
      {
        icon: <TrendingUpIcon />,
        title: 'Largest cost',
        hint: top
          ? `${top.name} · ${formatPercent(top.share, locale)} of spend`
          : 'Shows once a feature is used',
        value: top ? money(top.cost) : dash,
      },
      {
        icon: <CalendarClockIcon />,
        title: 'Daily average',
        hint:
          projected && periodEnd
            ? `About ${formatChartMoney(Math.round(Number(projected.amount)), projected.currency, locale)} by ${formatDate(periodEnd, locale)} at this pace`
            : `Spend per day, ${caption}`,
        value: money(daily),
      },
    ]
  }

  return (
    <section className="bg-background rounded-xl border">
      <div className="grid sm:grid-cols-3 sm:divide-x">
        {cells.map((c) => (
          <div
            key={c.title}
            className="flex flex-col gap-4 border-b px-6 py-5 last:border-b-0 sm:border-b-0"
          >
            <div className="flex items-center gap-3">
              <IconTile
                size="default"
                variant="outline"
                className="text-foreground/70"
                aria-hidden="true"
              >
                {c.icon}
              </IconTile>
              <div className="min-w-0">
                <p className="text-sm">{c.title}</p>
                <p className="text-muted-foreground truncate text-[13px]">{c.hint}</p>
              </div>
            </div>
            <div className="text-2xl font-medium tracking-tight tabular-nums">
              {c.value ?? <Skeleton className="h-8 w-28" />}
            </div>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground border-t px-6 py-3 text-[13px]">
        Spend is what usage adds to your next invoice, before credits and tax.
      </p>
    </section>
  )
}

/* ---- Usage trend --------------------------------------------------------- */

const ALL = 'all'

/**
 * One chart for any number of features. "All features" shows cost, the one
 * measure every feature shares; pick a feature to see its cost or its
 * quantity in its own unit.
 */
function UsageTrend({
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
  const effective = selected ? measure : 'cost'
  const currency = spend.status === 'ready' ? spend.data.currency : 'USD'

  const points = useMemo(() => {
    const source = selected ? [selected] : items
    const byTime = new Map<number, number>()
    for (const item of source) {
      for (const p of item.points) {
        const value = effective === 'cost' ? p.cost : p.usage
        byTime.set(p.at.getTime(), (byTime.get(p.at.getTime()) ?? 0) + value)
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

  const total = points.reduce((sum, p) => sum + p.value, 0)
  const unit = selected?.unit ?? ''
  const config: ChartConfig = {
    value: { label: effective === 'cost' ? 'Cost' : unit || 'Quantity', color: 'var(--primary)' },
  }
  const format = (value: number) =>
    effective === 'cost' ? formatChartMoney(value, currency, locale) : formatCompact(value, locale)
  const per = hourly ? 'hour' : 'day'

  return (
    <Section
      title="Usage trend"
      description={
        selected
          ? `${selected.name}, ${effective === 'usage' ? `in ${unit || 'units'}` : 'cost'} per ${per}`
          : `Cost per ${per} across all features`
      }
      action={
        items.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={featureId}
              onValueChange={(value) => {
                if (value === null) return
                setFeatureId(value)
                if (value === ALL) setMeasure('cost')
              }}
            >
              <SelectTrigger
                className="h-8 w-44"
                aria-label="Feature"
                // The trigger truncates a long name; hovering shows it whole.
                title={featureId === ALL ? 'All features' : selected?.name}
              >
                <SelectValue>
                  {(value) =>
                    value === ALL ? 'All features' : items.find((i) => i.featureId === value)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              {/* Wider than the trigger when the names need it, capped so the list
                  stays on screen; a name longer than that wraps rather than
                  running under the check mark. */}
              <SelectContent
                align="end"
                className="w-auto max-w-[min(22rem,calc(100vw-2rem))] min-w-(--anchor-width)"
              >
                <SelectItem value={ALL}>All features</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.featureId} value={i.featureId}>
                    <span className="min-w-0 break-words whitespace-normal">{i.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs
              value={effective}
              onValueChange={(value) => setMeasure(value as 'cost' | 'usage')}
            >
              <TabsList aria-label="Measure" className="bg-muted/60 h-8 rounded-lg p-1">
                <TabsTrigger value="cost" className="h-6 px-2.5 text-[13px] font-normal">
                  Cost
                </TabsTrigger>
                <TabsTrigger
                  value="usage"
                  disabled={!selected}
                  title={selected ? undefined : 'Pick a feature to see its quantity'}
                  className="h-6 px-2.5 text-[13px] font-normal"
                >
                  Quantity
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        ) : undefined
      }
    >
      <Loaded load={spend} label="usage" rows={1}>
        {(data) =>
          points.length === 0 ? (
            <PortalEmpty
              icon={<TrendingUpIcon />}
              title="No usage in this period"
              description="Your usage and its cost appear here as soon as your apps send events."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-2xl font-medium tracking-tight tabular-nums">
                {effective === 'cost' ? (
                  <Money
                    value={selected ? selected.cost : data.total}
                    {...(locale ? { locale } : {})}
                  />
                ) : (
                  <>
                    {formatCompact(total, locale)}
                    <span className="text-muted-foreground ml-1.5 text-sm font-normal">{unit}</span>
                  </>
                )}
                <span className="text-muted-foreground ml-2 text-[13px] font-normal">
                  in this period
                </span>
              </p>
              <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
                <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portal-trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    minTickGap={24}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tick={{ fontSize: 12 }}
                    tickFormatter={format}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => format(Number(value))} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={1.5}
                    fill="url(#portal-trend-fill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )
        }
      </Loaded>
    </Section>
  )
}

/* ---- Usage quota --------------------------------------------------------- */

const SEGMENTS = 48

/** Allowance per metered feature, with when it resets. */
function Allowances({
  quotas,
  locale,
}: {
  quotas: CustomerPortalData['quotas']
  locale: string | undefined
}) {
  return (
    <Section
      title="Usage quota"
      description="How much of each allowance you’ve used this billing period"
      flush
    >
      <Loaded load={quotas} label="allowances">
        {(rows) =>
          rows.length === 0 ? (
            <PortalEmpty
              icon={<GaugeIcon />}
              title="No allowances"
              description="Your plan has no metered allowances, so there’s nothing to track here."
            />
          ) : (
            <ul className="divide-border/50 divide-y">
              {rows.map((q) => (
                <QuotaRow key={q.featureId || q.name} quota={q} locale={locale} />
              ))}
            </ul>
          )
        }
      </Loaded>
    </Section>
  )
}

function QuotaRow({ quota: q, locale }: { quota: PortalQuota; locale: string | undefined }) {
  const unit = q.unit ? ` ${q.unit}` : ''
  const share =
    q.unlimited || !q.limit || Number(q.limit) === 0 ? 0 : Number(q.used) / Number(q.limit)
  const over = share > 1
  // Amber from 80%, red once over: the meter warns before the invoice does.
  const fill = over ? 'bg-destructive' : share > 0.8 ? 'bg-warning' : 'bg-primary'
  return (
    <li className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,11rem)] md:items-center md:gap-6">
      <div className="min-w-0">
        <p className="text-sm">{q.name}</p>
        <p className="text-muted-foreground text-[13px] tabular-nums">
          {formatCompact(q.used, locale)}
          {q.unlimited ? unit : ` of ${formatCompact(q.limit ?? '0', locale)}${unit}`}
        </p>
      </div>
      {q.unlimited ? (
        <p className="text-muted-foreground text-[13px]">Unlimited</p>
      ) : (
        <MeterTrack
          filled={filledSegments(Math.min(share, 1), 1, SEGMENTS)}
          segments={SEGMENTS}
          fill={fill}
          className="h-5"
        />
      )}
      <div className="text-[13px] md:text-right">
        {q.unlimited ? (
          <span className="text-muted-foreground">No limit</span>
        ) : over && q.over ? (
          <span className="text-destructive-foreground dark:text-destructive tabular-nums">
            {formatCompact(q.over, locale)} over · billed as usage
          </span>
        ) : (
          <span className="tabular-nums">{Math.round(share * 100)}% used</span>
        )}
        {q.resetsAt ? (
          <p className="text-muted-foreground text-xs">Resets {formatDate(q.resetsAt, locale)}</p>
        ) : null}
      </div>
    </li>
  )
}

/* ---- Usage breakdown ----------------------------------------------------- */

interface Group {
  name: string
  items: PortalSpendItem[]
  /** Display only: the sum of the group's costs. */
  cost: number
}

/** Features in their groups, the costliest group first; ungrouped features as "Other". */
function groupItems(items: PortalSpendItem[]): Group[] {
  const by = new Map<string, PortalSpendItem[]>()
  for (const item of items) {
    const key = item.group ?? 'Other'
    by.set(key, [...(by.get(key) ?? []), item])
  }
  return [...by.entries()]
    .map(([name, rows]) => ({
      name,
      items: rows,
      cost: rows.reduce((sum, r) => sum + Number(r.cost.amount), 0),
    }))
    .sort((a, b) => b.cost - a.cost)
}

/** Features grouped, with usage, unit cost, cost and share of spend. */
function Breakdown({
  spend,
  locale,
}: {
  spend: CustomerPortalData['spend']
  locale: string | undefined
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const toggle = (name: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  return (
    <Section title="Usage breakdown" description="What you used and what it cost, by feature" flush>
      <Loaded load={spend} label="usage">
        {(data) => {
          if (data.items.length === 0) {
            return (
              <PortalEmpty
                icon={<TrendingUpIcon />}
                title="No usage yet"
                description="Each feature’s usage and cost show up here."
              />
            )
          }
          const money = (value: PortalSpendItem['cost']) => (
            <Money value={value} {...(locale ? { locale } : {})} />
          )
          return (
            <div className="[scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-left text-[11px] tracking-wider uppercase">
                    <th scope="col" className="h-10 pl-6 font-normal">
                      Feature
                    </th>
                    <th scope="col" className="h-10 px-4 font-normal">
                      Usage
                    </th>
                    <th scope="col" className="h-10 px-4 font-normal">
                      Unit cost
                    </th>
                    <th scope="col" className="h-10 px-4 font-normal">
                      Cost
                    </th>
                    <th scope="col" className="h-10 pr-6 pl-4 font-normal">
                      Share of spend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupItems(data.items).flatMap((group) => {
                    const open = !closed.has(group.name)
                    const rows = [
                      <tr
                        key={`group:${group.name}`}
                        className="border-border/40 hover:bg-muted/30 h-12 border-b"
                      >
                        <td className="pl-4">
                          <button
                            type="button"
                            className="flex items-center gap-1.5"
                            aria-expanded={open}
                            onClick={() => toggle(group.name)}
                          >
                            <ChevronRightIcon
                              className={cn(
                                'text-muted-foreground size-4 transition-transform',
                                open && 'rotate-90',
                              )}
                              aria-hidden="true"
                            />
                            <span className="font-medium">{group.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {group.items.length}
                            </span>
                          </button>
                        </td>
                        <td className="px-4" />
                        <td className="px-4" />
                        <td className="px-4 font-medium tabular-nums">
                          {new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: data.currency,
                          }).format(group.cost)}
                        </td>
                        <td className="pr-6 pl-4" />
                      </tr>,
                    ]
                    if (!open) return rows
                    return [
                      ...rows,
                      ...group.items.map((item) => {
                        const price = item.unitCost
                          ? unitPriceLabel(item.unitCost, item.unit)
                          : null
                        return (
                          <tr key={item.featureId} className="border-border/40 h-12 border-b">
                            <td className="pl-12">{item.name}</td>
                            <td className="text-muted-foreground px-4 whitespace-nowrap tabular-nums">
                              {formatNumber(item.usage, locale)} {item.unit}
                            </td>
                            <td className="text-muted-foreground px-4 whitespace-nowrap tabular-nums">
                              {/* A tiered or mixed price has no one rate: its average, said so. */}
                              {price
                                ? `${item.unitCostIsAverage ? 'avg. ' : ''}${formatUnitPrice(price.amount.amount, price.amount.currency, locale)} per ${price.per}`
                                : '—'}
                            </td>
                            <td className="px-4 tabular-nums">{money(item.cost)}</td>
                            <td className="pr-6 pl-4">
                              <span className="flex items-center gap-3">
                                <MeterTrack
                                  filled={filledSegments(item.share, 1, 20)}
                                  segments={20}
                                  fill="bg-primary"
                                  className="h-4 w-32"
                                />
                                <span className="text-muted-foreground text-xs tabular-nums">
                                  {formatPercent(item.share, locale)}
                                </span>
                              </span>
                            </td>
                          </tr>
                        )
                      }),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )
        }}
      </Loaded>
    </Section>
  )
}
