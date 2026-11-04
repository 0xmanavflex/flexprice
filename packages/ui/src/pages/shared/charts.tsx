import { useEffect, useId, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { TrendingDownIcon, TrendingUpIcon } from '@ui/icons'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@ui/components/primitives/chart'
import type { ChartConfig } from '@ui/components/primitives/chart'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { SceneIllustration, type EmptyScene } from '@ui/compositions/feedback/SceneIllustration'
import { ChartSkeleton, ValuePlaceholder } from '@ui/compositions/feedback/Skeletons'
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
 * needed "one more colour": which is how a validated palette silently becomes
 * an unvalidated one. So no component in this library takes a colour. They take
 * a `ChartTone`, a closed union, and the mapping to tokens happens in exactly
 * one place below. A call site *cannot* express an unvalidated colour.
 *
 * The categorical/status split is the other half of it. `series-1..5` are the
 * categorical slots, handed out in fixed order and never cycled. `good`,
 * `warning` and `critical` are the status tokens, and they are reserved for
 * *state*: an invoice being overdue, a health reading being bad. Painting a
 * category green because green was next in the rotation is how a dashboard
 * teaches people that green means nothing.
 */
export const ChartsProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/chart',
    'ui/button',
    'compositions/feedback/RetryAction',
    'compositions/feedback/Skeletons',
  ],
  note: 'MetricChart (chart-6 metric tabs over chart-18’s gradient area) and BlurredEmpty. Also the ChartTone vocabulary the rest of the chart library paints with. Lineage: @reui/chart-6, @reui/chart-18.',
})

/* ---- Tones -------------------------------------------------------------- */

/**
 * What a mark may be painted.
 *
 * `series-*` are categorical: they mean "this is a different thing from that",
 * and carry no judgement. `good`/`warning`/`critical` are status, and they do
 * carry judgement: which is why they are not in the categorical rotation.
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

/*
 * The reference's chart palette: a blue family for categories, and one green,
 * amber and coral for status. Literal oklch because these are chart fills, the
 * one place a colour is allowed to sit outside the semantic tokens.
 */
const TONE_TOKENS: Record<ChartTone, string> = {
  'series-1': 'oklch(0.52 0.12 250)',
  'series-2': 'oklch(0.68 0.12 235)',
  'series-3': 'oklch(0.84 0.06 225)',
  'series-4': 'oklch(0.72 0.1 190)',
  'series-5': 'oklch(0.6 0.12 300)',
  good: 'oklch(0.6 0.13 165)',
  warning: 'oklch(0.8 0.14 80)',
  critical: 'oklch(0.66 0.19 35)',
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
 * series 6 the same colour, which reads as "these two are the same thing":
 * a worse failure than two adjacent series sharing the last slot, because every
 * component here also carries a legend and a tooltip, so identity never rests
 * on colour alone.
 */
export function seriesTone(index: number): ChartTone {
  return SERIES_TONES[Math.min(Math.max(index, 0), SERIES_TONES.length - 1)] ?? 'series-1'
}

/**
 * One tone, stepped light-to-dark: a **sequential** ramp.
 *
 * `@reui/stats-14` paints its segment matrix `indigo-600` down to `indigo-100`,
 * and that graduation is most of why the block reads the way it does. A
 * hard-coded indigo would put an unvalidated colour back into the library, so
 * the ramp is mixed from a tone against the card instead: same shape, still a
 * token, and it follows the surface into dark mode on its own.
 *
 * Index 0 is the full tone and the last step is the palest. Sequential, so
 * unlike the categorical slots adjacent steps are *meant* to be close: the
 * ΔE ≥ 15 floor is a rule about telling two categories apart, and these are
 * not two categories. Reach for it only when the steps encode magnitude; when
 * they encode identity, use `seriesTone`.
 */
export function toneRamp(tone: ChartTone, steps: number): string[] {
  const base = toneColor(tone)
  if (steps <= 1) return [base]
  return Array.from({ length: steps }, (_, index) => {
    /*
     * Linear from the full tone down to 15%, mixed in **oklab**.
     *
     * Both halves were arrived at by measuring the design's own tiles and then
     * solving for the weights that reproduce them, rather than by taste. The
     * fit is good to a few units per channel; it is not exact, because the
     * design's ramp was not mixed in this space, and chasing the last two
     * units would mean hard-coding seven stops that only work at one length.
     *
     * oklab, not oklch, and that is not a detail. White is `oklch(1 0 0)`:
     * lightness 1, chroma 0, hue *zero*: so an oklch mix interpolates the hue
     * angle from this blue's 264 degrees down to 0, and the ramp sweeps
     * through violet and pink on the way to pale. It did exactly that on
     * screen. oklab is rectangular: there is no hue angle to rotate, so the
     * tail is the head, only lighter.
     *
     * Against the surface rather than literal white, so the ramp follows the
     * card into dark mode instead of fading toward the wrong end.
     */
    const u = index / (steps - 1)
    const weight = 100 - 85 * u
    return `color-mix(in oklab, ${base} ${weight.toFixed(1)}%, var(--card))`
  })
}

/** Locale-grouped integers: the default any chart formats numbers with. */
export function formatWhole(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

/**
 * A percentage change, as a badge.
 *
 * Not coloured text: `text-success` as small foreground text measures 2.95:1
 * against the card, which fails. The light badge variants put the colour in a
 * tinted fill behind dark text, which passes: and the arrow means the sign is
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

/** `true` when the viewer has asked their system for less motion. Read once, kept live. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** One bucket of a metric series. */
export interface MetricPoint {
  /** Axis label, already formatted for the chosen granularity by the page. */
  label: string
  value: number
  /** Other series on the same buckets, keyed by `MetricSeries.id`. */
  extra?: Record<string, number> | undefined
}

/** One line on a tab that plots more than one series, such as a currency. */
export interface ChartSeries {
  id: string
  label: string
  format?: ((value: number) => string) | undefined
}

/**
 * One tab, and the series it plots.
 *
 * `value` is a `ReactNode` rather than a number because the headline is often
 * not a bare count: it is `<Money>`, or a duration, or a percentage. The page
 * has the domain type; this component does not, and should not start
 * formatting currency.
 */
export type MetricTabStatus = 'ready' | 'loading' | 'unavailable'

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
  /**
   * Extra lines drawn with `points[].extra`. When set, each one is plotted and
   * `value` is the headline only. With more than one, each line has its own
   * scale, so two currencies (or any two units) share the chart without the
   * smaller one flattening against the larger.
   */
  series?: ChartSeries[] | undefined
  /** Formats a point for the tooltip. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /**
   * Whether the figure is known. `loading` draws a placeholder bar and a chart
   * skeleton; `unavailable` says so (with a retry when `onRetry` is given).
   * Neither ever shows a dash or a zero, which would read as "no value".
   * Omitted, the tab is `ready`.
   */
  status?: MetricTabStatus | undefined
  /** Retry for an `unavailable` tab. */
  onRetry?: (() => void) | undefined
  /**
   * What a `ready` tab with no points says in place of the plot. Defaults to
   * "No {label} in this period", which is only true when the window is empty:
   * pass something else for a metric that simply has no series.
   */
  emptyMessage?: string | undefined
  /**
   * No series exists for this metric. Omit the plot instead of an empty box.
   */
  hideChart?: boolean | undefined
}

export interface MetricChartProps {
  /** The tabs across the top, in display order. */
  tabs: MetricTab[]
  /** Which tab is showing. **The page owns this**: the component holds no state. */
  activeTab: string
  onTabChange: (id: string) => void
  /** Sub-label under the plot, e.g. "Last 30 days". */
  caption?: string | undefined
  /** Plot height in px, excluding the tab strip. Default 260. */
  height?: number | undefined
  className?: string | undefined
}

/**
 * KPI tabs over one series, in the console's panel: a soft tray, a row of
 * metric tabs, and the selected series drawn as a single line with a light fill.
 * One colour, min and max as the only annotation. The active tab keeps the
 * foreground underline on its bottom edge rather than a tinted fill.
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
  height = 260,
  className,
}: MetricChartProps) {
  const uid = useId().replace(/:/g, '')
  // Falling back to the first tab rather than rendering blank: an `activeTab`
  // that matches nothing is a page bug, and a panel that silently shows nothing
  // is the hardest version of it to notice.
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  if (!active) return null

  // Equal columns at every width from `md` up: the strip divides its width by
  // the number of tabs rather than by a fixed 3 or 6, so four tabs are four
  // equal cells and never three-and-one. Below `md` they sit two to a row.
  const columns = { '--tab-cols': tabs.length } as CSSProperties

  // WAI-ARIA tabs: one tab stop (the selected one), arrows move between tabs,
  // Home/End jump to the ends. Selection follows focus, as the panel is cheap.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    const target = tabs[next]
    if (!target) return
    onTabChange(target.id)
    document.getElementById(`${uid}-tab-${target.id}`)?.focus()
  }

  return (
    <div className={cn('bg-muted/40 rounded-xl border p-1', className)}>
      <div
        className="grid grid-cols-2 md:grid-cols-[repeat(var(--tab-cols),minmax(0,1fr))]"
        style={columns}
        role="tablist"
        aria-label="Metrics"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`${uid}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            aria-controls={`${uid}-panel`}
            tabIndex={tab.id === active.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={cn(
              'relative flex min-w-0 flex-col items-start gap-1 px-4 py-3 text-left transition-colors',
              index > 0 && 'md:border-l',
              tab.id === active.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="text-xs">{tab.label}</span>
            <span className="text-foreground flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-medium tabular-nums">
              {tab.status === 'loading' ? (
                <ValuePlaceholder width={7} label={`Loading ${tab.label}`} />
              ) : tab.status === 'unavailable' ? (
                <span className="text-muted-foreground text-sm font-normal">Unavailable</span>
              ) : (
                tab.value
              )}
              {tab.status === 'loading' ||
              tab.status === 'unavailable' ||
              tab.changePercent === undefined ? null : (
                <TrendBadge percent={tab.changePercent} />
              )}
            </span>
            {tab.id === active.id ? (
              <span
                className="bg-foreground absolute inset-x-4 bottom-0 h-0.5 rounded-full"
                aria-hidden="true"
              />
            ) : null}
          </button>
        ))}
      </div>
      {/* No frame around a chart that is not drawn (`hideChart` with no points). */}
      {active.hideChart && active.points.length === 0 ? null : (
        <div
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${active.id}`}
          className="bg-background rounded-lg border p-4"
        >
          <MetricSeries tab={active} height={height} {...(caption ? { caption } : {})} />
        </div>
      )}
    </div>
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
  const reducedMotion = usePrefersReducedMotion()
  // Namespaces the gradient: two MetricCharts on one page would otherwise
  // define the same SVG id, and the second silently repaints the first.
  const chartId = useId().replace(/:/g, '')

  if (tab.status === 'loading') {
    return (
      <div className="flex flex-col gap-2">
        <ChartSkeleton height={height} label={`Loading ${tab.label.toLowerCase()}`} />
      </div>
    )
  }

  if (tab.status === 'unavailable') {
    return (
      <div className="flex flex-col gap-2">
        <div
          role="alert"
          className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-sm"
          style={{ height }}
        >
          <span>{tab.label} couldn’t be loaded.</span>
          {tab.onRetry ? <RetryAction onRetry={tab.onRetry} /> : null}
        </div>
        {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
      </div>
    )
  }

  if (tab.hideChart && tab.points.length === 0) return null

  if (tab.points.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="border-border text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-4 text-sm"
          style={{ height }}
          role="img"
          aria-label={tab.emptyMessage ?? `${tab.label}: no data for this period`}
        >
          {tab.emptyMessage ?? `No ${tab.label.toLowerCase()} in this period`}
        </div>
        {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
      </div>
    )
  }

  const lines = tab.series?.length ? tab.series : [{ id: 'value', label: tab.label, format }]
  const values = tab.points.flatMap((point) =>
    lines.map((line) => (line.id === 'value' ? point.value : (point.extra?.[line.id] ?? 0))),
  )
  const min = Math.min(...values)
  const max = Math.max(...values)
  const multi = lines.length > 1
  const config = {
    ...Object.fromEntries(
      lines.map((line, index) => [
        line.id,
        { label: line.label, color: toneColor(seriesTone(index)) },
      ]),
    ),
  } satisfies ChartConfig

  return (
    <div className="flex flex-col">
      <div className="text-muted-foreground mb-2 flex flex-wrap justify-end gap-3 text-xs">
        {multi ? (
          // One peak per line, in its own unit: a minimum and maximum across
          // currencies would compare figures that cannot be compared.
          lines.map((line, index) => {
            // The same reading the line plots: `value` is the point's own, the
            // rest come from `extra`.
            const peak = Math.max(
              ...tab.points.map((point) =>
                line.id === 'value' ? point.value : (point.extra?.[line.id] ?? 0),
              ),
            )
            return (
              <span key={line.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: toneColor(seriesTone(index)) }}
                />
                {line.label}
                <span className="text-foreground font-medium tabular-nums">
                  {(line.format ?? format)(peak)}
                </span>
              </span>
            )
          })
        ) : (
          <>
            <span>
              Min <span className="text-foreground font-medium tabular-nums">{format(min)}</span>
            </span>
            <span>
              Max <span className="text-foreground font-medium tabular-nums">{format(max)}</span>
            </span>
          </>
        )}
      </div>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height } as CSSProperties}
        role="img"
        aria-label={
          multi
            ? `${tab.label} in ${lines.map((line) => line.label).join(' and ')}, over ${tab.points.length} buckets`
            : `${tab.label} over ${tab.points.length} buckets, from ${format(min)} to ${format(max)}`
        }
      >
        <AreaChart
          accessibilityLayer
          data={tab.points.map((point) => ({
            label: point.label,
            value: point.value,
            ...point.extra,
          }))}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            {lines.map((line) => (
              <linearGradient
                key={line.id}
                id={`${chartId}-${line.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={`var(--color-${line.id})`} stopOpacity={0.12} />
                <stop offset="100%" stopColor={`var(--color-${line.id})`} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          {multi ? (
            lines.map((line) => (
              <YAxis
                key={line.id}
                yAxisId={line.id}
                hide
                domain={[(low: number) => low * 0.85, (high: number) => high * 1.05]}
              />
            ))
          ) : (
            <YAxis hide domain={[(low: number) => low * 0.85, (high: number) => high * 1.05]} />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const line = lines.find((entry) => entry.id === name)
                  const text = (line?.format ?? format)(Number(value))
                  return `${line?.label ?? tab.label}: ${text}`
                }}
              />
            }
          />
          {lines.map((line) => (
            <Area
              key={line.id}
              type="monotone"
              dataKey={line.id}
              {...(multi ? { yAxisId: line.id } : {})}
              stroke={`var(--color-${line.id})`}
              strokeWidth={1.5}
              fill={multi ? 'transparent' : `url(#${chartId}-${line.id})`}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </AreaChart>
      </ChartContainer>
      {caption ? <p className="text-muted-foreground mt-2 text-xs">{caption}</p> : null}
    </div>
  )
}

/* ---- BlurredEmpty ------------------------------------------------------- */

/** A button in the message card. Label and what it does: nothing else. */
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
  /** Beside the primary: docs, an import, a sample. */
  secondaryAction?: BlurredEmptyAction | undefined
  /** A small drawing above the message. Omit it on a page that is mostly chart. */
  scene?: EmptyScene | undefined
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
 * matter: `aria-hidden` alone leaves a tabbable tooltip trigger that a
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
  scene,
  className,
}: BlurredEmptyProps) {
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none opacity-70 blur-[3px] select-none"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-background/95 flex max-w-sm flex-col items-center gap-4 rounded-xl border px-7 py-6 text-center shadow-[0_8px_24px_-12px_rgba(15,42,61,0.18)]">
          {scene ? <SceneIllustration scene={scene} className="w-36" /> : null}
          <div className="space-y-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-[13px]/relaxed">{description}</p>
          </div>
          {action || secondaryAction ? (
            <div className="flex items-center gap-2">
              {secondaryAction ? (
                <Button variant="outline" className="h-8 px-3.5" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              ) : null}
              {action ? (
                <Button className="h-8 px-3.5" onClick={action.onClick}>
                  {action.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
