import type { ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@ui/components/primitives/chart'
import type { ChartConfig } from '@ui/components/primitives/chart'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { ValuePlaceholder } from '@ui/compositions/feedback/Skeletons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, toneColor } from './charts'
import type { ChartTone } from './charts'

/**
 * A half-donut with a total in the middle and the parts underneath.
 *
 * `@reui/chart-12`'s gauge: a 180°-to-0° pie with a large inner radius, hung so
 * its centre sits near the foot of the box, the running total floating in the
 * gap, and a divided footer reading the slices out. The block binds all of that
 * to its own capital-inflow figures and takes no props, so what is reused is
 * the geometry: the angles, the radii, the `cy` that makes the arc sit right,
 * the 1° padding and 3px corners that keep adjacent slices distinct.
 *
 * The footer is not decoration and not optional: it is the legend. A donut with
 * three slices asks you to map three colours to three meanings, and the only
 * accessible way to answer that is in text beside the swatch. It doubles as the
 * numeric readout, so nothing on this panel is only available on hover.
 *
 * A window where everything is zero draws a single muted ring rather than
 * nothing. An empty box reads as a chart that failed to load; a complete ring
 * with `0` in the middle reads as the answer, which is what it is.
 *
 * That only holds when the window really is empty. `status` lets a caller say
 * the figures are still `loading`, `error`ed, or `empty` without ever drawing a
 * 0: loading shows bars where the numbers go, an error says "Unavailable" and
 * offers a retry, and `empty` shows an em dash. Omitted, `status` is `ready`
 * and the all-zero ring above applies, so existing callers are unchanged.
 */
export const HalfDonutProvenance = provenance({
  source: 'composition',
  composes: ['ui/chart', 'compositions/feedback/RetryAction', 'compositions/feedback/Skeletons'],
  note: 'chart-12 half-donut geometry over real slices, tones from the validated palette, centre total and footer legend. Lineage: @reui/chart-12.',
})

/** One slice of the ring. */
export interface DonutSlice {
  /** Stable key. */
  id: string
  /** Footer and tooltip label. */
  label: string
  value: number
  /**
   * Which token paints it.
   *
   * Status tones (`good`/`warning`/`critical`) when the slices are *states*:
   * paid, open, overdue. Categorical tones (`series-*`) when they are merely
   * different things. Mixing the two teaches people that a colour means
   * nothing, which is the one thing a status colour cannot survive.
   */
  tone: ChartTone
}

export interface HalfDonutProps {
  slices: DonutSlice[]
  /** Small caption above the centre figure, e.g. "Invoices". */
  centerLabel: string
  /** The centre figure, already formatted: a count, a `<Money>`, a percentage. */
  centerValue: ReactNode
  /** Formats slice values for the tooltip and footer. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the plot. */
  label: string
  className?: string | undefined
  /**
   * What the figures are. `loading` and `error` draw the empty ring with no
   * numbers; `empty` draws it with an em dash instead of the centre value.
   */
  status?: 'ready' | 'loading' | 'error' | 'empty' | undefined
  /** Offered in the `error` state. */
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
}

export function HalfDonut({
  slices,
  centerLabel,
  centerValue,
  format = formatWhole,
  label,
  className,
  status = 'ready',
  onRetry,
  isRetrying,
}: HalfDonutProps) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0)
  const loading = status === 'loading'
  const failed = status === 'error'
  const unknown = loading || failed
  const empty = unknown || status === 'empty' || total <= 0

  // Recharts needs something with a non-zero value to draw an arc at all, so an
  // all-zero window is drawn as one full muted ring: the track, not a slice.
  const data = empty
    ? [{ id: '__track__', label: centerLabel, value: 1, tone: 'neutral' as ChartTone }]
    : slices.filter((slice) => slice.value > 0)

  const config = Object.fromEntries(
    slices.map((slice) => [slice.id, { label: slice.label, color: toneColor(slice.tone) }]),
  ) satisfies ChartConfig

  return (
    <div className={cn('flex flex-col gap-6', className)} aria-busy={loading || undefined}>
      {loading ? (
        <span role="status" className="sr-only">
          Loading {label}
        </span>
      ) : null}
      <div className="relative mx-auto h-[150px] w-full max-w-[290px]">
        <ChartContainer
          config={config}
          className="aspect-auto h-full w-full overflow-visible"
          initialDimension={{ width: 290, height: 150 }}
          role="img"
          aria-label={
            loading
              ? `${label}: loading`
              : failed
                ? `${label}: unavailable`
                : empty
                  ? `${label}: nothing in this period`
                  : `${label}: ${slices
                      .map((slice) => `${slice.label} ${format(slice.value)}`)
                      .join(', ')}`
          }
        >
          <PieChart accessibilityLayer margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            {empty ? null : (
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    nameKey="id"
                    formatter={(value, _name, item) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {(item.payload as DonutSlice | undefined)?.label}
                        </span>
                        <span className="text-foreground font-medium tabular-nums">
                          {format(Number(value))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
            )}
            <Pie
              data={data}
              dataKey="value"
              nameKey="id"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="96%"
              innerRadius={88}
              outerRadius={118}
              paddingAngle={1.2}
              cornerRadius={3}
              stroke="var(--background)"
              strokeWidth={1.5}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.id} fill={empty ? 'var(--muted)' : toneColor(slice.tone)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="pointer-events-none absolute inset-x-0 top-[78px] flex flex-col items-center">
          <span className="text-muted-foreground text-xs">{centerLabel}</span>
          <span className="text-2xl font-medium tabular-nums">
            {loading ? (
              <ValuePlaceholder width={5} label={`Loading ${centerLabel}`} />
            ) : failed ? (
              <span className="text-muted-foreground text-sm font-normal">Unavailable</span>
            ) : status === 'empty' ? (
              <span className="text-muted-foreground">{'\u2014'}</span>
            ) : (
              centerValue
            )}
          </span>
        </div>
      </div>

      {failed && onRetry ? (
        <div className="flex justify-center">
          <RetryAction onRetry={onRetry} {...(isRetrying !== undefined ? { isRetrying } : {})} />
        </div>
      ) : null}

      {/* The legend, and the numeric readout, in one row. */}
      <ul
        className="grid divide-x border-t pt-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(slices.length, 1)}, minmax(0, 1fr))` }}
      >
        {slices.map((slice) => (
          <li key={slice.id} className="flex min-w-0 flex-col items-center gap-1 px-2 text-center">
            {/* `min-w-0 max-w-full` so a long label ellipses instead of spilling into the next column. */}
            <span className="text-muted-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: empty ? 'var(--muted-foreground)' : toneColor(slice.tone),
                  opacity: empty ? 0.35 : 1,
                }}
              />
              <span className="truncate">{slice.label}</span>
            </span>
            {unknown ? (
              loading ? (
                <ValuePlaceholder width={4} label={`Loading ${slice.label}`} />
              ) : (
                <span className="text-muted-foreground text-xs">Unavailable</span>
              )
            ) : status === 'empty' ? (
              <span className="text-muted-foreground text-[15px]">{'\u2014'}</span>
            ) : (
              <span className="text-[15px] font-medium tabular-nums">{format(slice.value)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
