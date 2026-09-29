import type { CSSProperties, ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import { ChartContainer, ChartTooltip } from '@ui/primitives/chart'
import type { ChartConfig } from '@ui/primitives/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/primitives/tabs'
import { EmptyState } from '@ui/compositions/EmptyState'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The console's shared chart vocabulary.
 *
 * Two things live here, and one of them is not a component: the **tone**
 * vocabulary every chart in this library paints with.
 *
 * The series palette (`--chart-1..5`) was derived and contrast-validated once,
 * in both modes, and written into `styles.css`. The failure mode it guards
 * against is a component reaching for a hex or a `bg-indigo-500` because it
 * needed "one more colour" — which is how a validated palette silently becomes
 * an unvalidated one. So no component in this library takes a colour. They take
 * a `ChartTone`, a closed union, and the mapping to tokens happens in exactly
 * one place below. A call site *cannot* express an unvalidated colour.
 *
 * The categorical/status split is the other half of it. `series-1..5` are the
 * categorical slots, handed out in fixed order and never cycled. `good`,
 * `warning` and `critical` are the status tokens, and they are reserved for
 * *state* — an invoice being overdue, a health reading being bad. Painting a
 * category green because green was next in the rotation is how a dashboard
 * teaches people that green means nothing.
 */
export const ChartsProvenance = provenance({
  source: 'composition',
  composes: ['ui/chart', 'ui/tabs', 'compositions/EmptyState'],
  note: 'MetricChart (shadcn Chart + Tabs, after the Vercel console) and BlurredEmpty. Also the ChartTone vocabulary the rest of the chart library paints with.',
})

/* ---- Tones -------------------------------------------------------------- */

/**
 * What a mark may be painted.
 *
 * `series-*` are categorical: they mean "this is a different thing from that",
 * and carry no judgement. `good`/`warning`/`critical` are status, and they do
 * carry judgement — which is why they are not in the categorical rotation.
 * `neutral` is the "everything else"/remainder tone.
 */
export type ChartTone =
  | 'series-1'
  | 'series-2'
  | 'series-3'
  | 'series-4'
  | 'series-5'
  | 'good'
  | 'warning'
  | 'critical'
  | 'neutral'

const TONE_TOKENS: Record<ChartTone, string> = {
  'series-1': 'var(--chart-1)',
  'series-2': 'var(--chart-2)',
  'series-3': 'var(--chart-3)',
  'series-4': 'var(--chart-4)',
  'series-5': 'var(--chart-5)',
  good: 'var(--success)',
  warning: 'var(--warning)',
  critical: 'var(--destructive)',
  neutral: 'var(--muted-foreground)',
}

/** The CSS colour a tone paints with. Always a token, never a literal. */
export function toneColor(tone: ChartTone): string {
  return TONE_TOKENS[tone]
}

/** The categorical slots, in the order they are handed out. */
const SERIES_TONES: ChartTone[] = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5']

/**
 * The tone for the nth series.
 *
 * Deliberately **clamps** rather than wrapping. Cycling would give series 1 and
 * series 6 the same colour, which reads as "these two are the same thing" —
 * a worse failure than two adjacent series sharing the last slot, because every
 * component here also carries a legend and a tooltip, so identity never rests
 * on colour alone.
 */
export function seriesTone(index: number): ChartTone {
  return SERIES_TONES[Math.min(Math.max(index, 0), SERIES_TONES.length - 1)] ?? 'series-1'
}

/** Locale-grouped integers — the default any chart formats numbers with. */
export function formatWhole(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

/**
 * A percentage change, as a badge.
 *
 * Not coloured text: `text-success` as small foreground text measures 2.95:1
 * against the card, which fails. The light badge variants put the colour in a
 * tinted fill behind dark text, which passes — and the arrow means the sign is
 * not carried by colour alone.
 */
export function TrendBadge({ percent }: { percent: number }) {
  const positive = percent >= 0
  const formatted = `${positive ? '+' : ''}${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(percent)}%`

  return (
    <Badge
      variant={positive ? 'success-light' : 'destructive-light'}
      size="sm"
      className="w-fit shrink-0 gap-1 border-0"
    >
      {positive ? <TrendingUpIcon aria-hidden /> : <TrendingDownIcon aria-hidden />}
      {formatted}
    </Badge>
  )
}

/* ---- MetricChart -------------------------------------------------------- */

/** One bucket of a metric series. */
export interface MetricPoint {
  /** Axis label, already formatted for the chosen granularity by the page. */
  label: string
  value: number
}

/**
 * One tab, and the series it plots.
 *
 * `value` is a `ReactNode` rather than a number because the headline is often
 * not a bare count — it is `<Money>`, or a duration, or a percentage. The page
 * has the domain type; this component does not, and should not start
 * formatting currency.
 */
export interface MetricTab {
  /** Stable id. What `onTabChange` reports and what `activeTab` is matched against. */
  id: string
  /** Short noun, e.g. "Requests". Names the tab and labels the series. */
  label: string
  /** The headline figure under the label, already formatted. */
  value: ReactNode
  /** Change against the previous window, as a percentage. Omitted when there is nothing to compare. */
  changePercent?: number | undefined
  /** The series drawn while this tab is selected. Empty renders the no-data state. */
  points: MetricPoint[]
  /** Formats a point for the tooltip. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
}

export interface MetricChartProps {
  /** The tabs across the top, in display order. */
  tabs: MetricTab[]
  /** Which tab is showing. **The page owns this** — the component holds no state. */
  activeTab: string
  onTabChange: (id: string) => void
  /** Sub-label under the plot, e.g. "Last 30 days". */
  caption?: string | undefined
  /** Plot height in px, excluding the tab strip. Default 240. */
  height?: number | undefined
  className?: string | undefined
}

/**
 * Tabs across the top, a line below — the Vercel console's metric panel.
 *
 * Not a ReUI block. The shape is shadcn's `Chart` (recharts) under a tab strip
 * where each tab is a *stat*: a label, the figure for the window, and its
 * trend. That is what makes the strip worth its height — you read four numbers
 * without switching, and switching plots the one you read.
 *
 * Fully controlled, and that is load-bearing rather than stylistic. Which
 * metric you are looking at is the kind of thing a page wants to put in the
 * URL, restore on back, or keep in step with a second panel. A component that
 * owned it with `useState` would make all three impossible.
 *
 * One series per tab, so there is no legend: the tab *is* the legend, and the
 * chart never asks you to tell two lines apart by colour.
 */
export function MetricChart({
  tabs,
  activeTab,
  onTabChange,
  caption,
  height = 240,
  className,
}: MetricChartProps) {
  // Falling back to the first tab rather than rendering blank: an `activeTab`
  // that matches nothing is a page bug, and a panel that silently shows nothing
  // is the hardest version of it to notice.
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  if (!active) return null

  return (
    <Tabs
      value={active.id}
      onValueChange={(value) => onTabChange(String(value))}
      className={cn('bg-card gap-0 overflow-hidden rounded-xl border', className)}
    >
      <TabsList
        variant="line"
        className="divide-border w-full flex-none gap-0 divide-x rounded-none border-b p-0 group-data-horizontal/tabs:h-auto"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'h-auto flex-1 flex-col items-start justify-start gap-2 rounded-none px-4 py-3.5 text-left',
              // The accent sits on the bottom edge, against the plot it drives.
              'border-0 border-b-2 border-transparent',
              'data-active:border-chart-1 data-active:bg-muted',
            )}
          >
            <span className="text-muted-foreground text-xs font-medium">{tab.label}</span>
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-foreground text-xl leading-none font-semibold tabular-nums">
                {tab.value}
              </span>
              {tab.changePercent === undefined ? null : <TrendBadge percent={tab.changePercent} />}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="px-4 pt-5 pb-4">
          {/*
           * Only the selected panel builds a chart. The others still render, so
           * the tab/panel relationship stays intact for a screen reader, but a
           * four-tab panel does not mount four recharts trees to show one.
           */}
          {tab.id === active.id ? (
            <MetricSeries tab={tab} height={height} {...(caption ? { caption } : {})} />
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function MetricSeries({
  tab,
  height,
  caption,
}: {
  tab: MetricTab
  height: number
  caption?: string | undefined
}) {
  const format = tab.format ?? formatWhole
  const config = {
    value: { label: tab.label, color: 'var(--chart-1)' },
  } satisfies ChartConfig

  if (tab.points.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="border-border text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-4 text-sm"
          style={{ height }}
          role="img"
          aria-label={`${tab.label}: no data for this period`}
        >
          No {tab.label.toLowerCase()} in this period
        </div>
        {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
      </div>
    )
  }

  const values = tab.points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height } as CSSProperties}
        role="img"
        aria-label={`${tab.label} over ${tab.points.length} buckets, from ${format(min)} to ${format(max)}`}
      >
        <LineChart
          accessibilityLayer
          data={tab.points}
          margin={{ top: 12, right: 12, bottom: 4, left: 12 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis hide domain={[0, 'auto']} />
          {/* The crosshair: a dashed vertical rule following the pointer. */}
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={({ active: hovered, payload, label }) =>
              hovered && payload?.length ? (
                <div className="bg-popover min-w-[11rem] rounded-lg border p-3 shadow-lg">
                  <div className="border-border text-popover-foreground mb-2 border-b pb-1.5 text-sm font-semibold">
                    {String(label)}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                      <span aria-hidden className="bg-chart-1 size-2.5 rounded-sm" />
                      {tab.label}
                    </span>
                    <span className="text-popover-foreground text-sm font-semibold tabular-nums">
                      {format(Number(payload[0]?.value ?? 0))}
                    </span>
                  </div>
                </div>
              ) : null
            }
          />
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-value)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
    </div>
  )
}

/* ---- BlurredEmpty ------------------------------------------------------- */

/** A button in the message card. Label and what it does — nothing else. */
export interface BlurredEmptyAction {
  label: string
  onClick: () => void
}

export interface BlurredEmptyProps {
  /** The chart to blur behind the message. Rendered inert and hidden from assistive tech. */
  children: ReactNode
  title: string
  /** One sentence: why there is nothing, and what fills it. */
  description: string
  /** The thing to do about it. */
  action?: BlurredEmptyAction | undefined
  /** Beside the primary — docs, an import, a sample. */
  secondaryAction?: BlurredEmptyAction | undefined
  className?: string | undefined
}

/**
 * A chart that has no data yet, shown as a shape rather than a hole.
 *
 * The panel keeps its height and the chart keeps its outline, blurred, with the
 * message floating over it. Two reasons, both learned: a panel that collapses
 * to an empty state shifts everything below it the moment data arrives, and a
 * blank rectangle tells you nothing about what will eventually be there.
 *
 * The blurred chart is **decoration**, and the markup says so three times over:
 * `aria-hidden` keeps it out of the accessibility tree, `inert` takes its
 * controls and its text out of focus and find-in-page, and
 * `pointer-events-none` stops it eating clicks aimed at the card. All three
 * matter — `aria-hidden` alone leaves a tabbable tooltip trigger that a
 * keyboard user lands on and a screen reader then refuses to describe, which is
 * the worst of both.
 *
 * Whatever is passed as `children` is usually fed placeholder-shaped numbers by
 * the page. That is fine *because* it is inert and unreadable: it is a texture,
 * not a claim. The moment it would be legible it would be a lie, which is the
 * line `DashboardHome` already draws.
 */
export function BlurredEmpty({
  children,
  title,
  description,
  action,
  secondaryAction,
  className,
}: BlurredEmptyProps) {
  return (
    <div className={cn('relative isolate', className)}>
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none opacity-40 blur-[3px] select-none"
      >
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
        <div className="bg-card w-full max-w-md rounded-xl border p-1 shadow-lg">
          <EmptyState
            size="inline"
            title={title}
            description={description}
            {...(action
              ? { action: <Button onClick={action.onClick}>{action.label}</Button> }
              : {})}
            {...(secondaryAction
              ? {
                  secondaryAction: (
                    <Button variant="outline" onClick={secondaryAction.onClick}>
                      {secondaryAction.label}
                    </Button>
                  ),
                }
              : {})}
          />
        </div>
      </div>
    </div>
  )
}
