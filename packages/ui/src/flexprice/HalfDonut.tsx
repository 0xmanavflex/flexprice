import type { CSSProperties, ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip } from '@ui/primitives/chart'
import { Item, ItemMedia } from '@ui/primitives/item'
import { Separator } from '@ui/primitives/separator'
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
 * the geometry — the angles, the radii, the `cy` that makes the arc sit right,
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
 */
export const HalfDonutProvenance = provenance({
  source: 'composition',
  composes: ['@reui/chart-12', 'ui/chart', 'ui/separator'],
  note: 'chart-12 half-donut geometry, its graph-paper backdrop and its tiled footer, over real slices and validated tones.',
})

/**
 * The block's backdrop: graph paper behind the arc, twice.
 *
 * A flat 8px grid faded out downward, and a second blurred copy of it masked
 * to an ellipse behind the arc so the gauge sits in a soft pool of light
 * rather than on a plain card. It is decoration and nothing reads it, which
 * is why it is `aria-hidden` — but it is *most* of what makes chart-12 look
 * like chart-12, and dropping it was why this panel did not.
 *
 * Copied from the block unchanged, down to the mask stops and opacities.
 */
function GaugeGrid() {
  const gridPattern =
    '[background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:8px_8px]'

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden"
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-40 [mask-image:linear-gradient(to_bottom,black_0%,black_42%,transparent_100%)] opacity-35',
          gridPattern,
        )}
      />
      <div
        className={cn(
          'absolute -inset-x-8 top-7 h-44 [mask-image:radial-gradient(ellipse_88%_76%_at_50%_16%,black_0%,black_46%,transparent_100%)] opacity-45 blur-md',
          gridPattern,
        )}
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_bottom,transparent_0%,var(--card)_72%,var(--card)_100%)]" />
    </div>
  )
}

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
   * Status tones (`good`/`warning`/`critical`) when the slices are *states* —
   * paid, open, overdue. Categorical tones (`series-*`) when they are merely
   * different things. Mixing the two teaches people that a colour means
   * nothing, which is the one thing a status colour cannot survive.
   */
  tone: ChartTone
  /**
   * The glyph in this slice's footer tile.
   *
   * chart-12 puts a logo in each; here it is whatever names the slice — a
   * clock for overdue, a tick for paid. Omit it and the tile is a plain
   * colour chip, which still carries the mapping back to the arc.
   */
  icon?: ReactNode | undefined
}

/**
 * chart-12's footer swatch: a 32px colour tile, stippled and glossed.
 *
 * The block's version is a brand logo, so it drops to `dark:bg-neutral-950`
 * and lets the white glyph carry it. Ours cannot: this tile is the only thing
 * tying a footer column back to its slice on the arc, so it keeps the slice's
 * tone in both modes. Everything else — the size, the white ring, the shadow,
 * the stipple and the top gloss — is the block's.
 */
function SliceTile({ slice }: { slice: DonutSlice }) {
  return (
    <Item
      className="dark:border-border relative isolate flex size-8 items-center justify-center overflow-hidden border-2 border-white bg-[var(--slice-tile)] p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] [&_svg]:size-4 [&_svg]:text-white"
      style={{ '--slice-tile': toneColor(slice.tone) } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.22)_0.6px,transparent_0.65px)] [background-size:3px_3px] opacity-0 dark:opacity-[0.38]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] [background-image:radial-gradient(48.05%_48.05%_at_50%_5.95%,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_100%)]"
      />
      {slice.icon === undefined ? null : (
        <ItemMedia variant="icon" className="relative z-10 size-auto">
          {slice.icon}
        </ItemMedia>
      )}
    </Item>
  )
}

export interface HalfDonutProps {
  slices: DonutSlice[]
  /** Small caption above the centre figure, e.g. "Invoices". */
  centerLabel: string
  /** The centre figure, already formatted — a count, a `<Money>`, a percentage. */
  centerValue: ReactNode
  /** Formats slice values for the tooltip and footer. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the plot. */
  label: string
  className?: string | undefined
}

export function HalfDonut({
  slices,
  centerLabel,
  centerValue,
  format = formatWhole,
  label,
  className,
}: HalfDonutProps) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0)
  const empty = total <= 0

  // Recharts needs something with a non-zero value to draw an arc at all, so an
  // all-zero window is drawn as one full muted ring — the track, not a slice.
  const data = empty
    ? [{ id: '__track__', label: centerLabel, value: 1, tone: 'neutral' as ChartTone }]
    : slices.filter((slice) => slice.value > 0)

  return (
    <div className={cn('relative flex flex-col', className)}>
      <GaugeGrid />

      <div className="relative mx-auto h-[158px] w-full max-w-[300px]">
        <ChartContainer
          config={{}}
          className="aspect-auto h-full w-full overflow-visible"
          initialDimension={{ width: 300, height: 158 }}
          role="img"
          aria-label={
            empty
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
                content={({ active, payload }) => {
                  const slice = payload?.[0]?.payload as DonutSlice | undefined
                  if (!active || !slice) return null
                  const share = total > 0 ? Math.round((slice.value / total) * 100) : 0
                  return (
                    <div className="bg-popover rounded-lg border px-2.5 py-2 shadow-lg">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ backgroundColor: toneColor(slice.tone) }}
                        />
                        <span className="text-popover-foreground text-xs font-medium">
                          {slice.label}
                        </span>
                        <span className="text-popover-foreground ms-2 text-xs font-semibold tabular-nums">
                          {format(slice.value)}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">{share}%</span>
                      </div>
                    </div>
                  )
                }}
              />
            )}
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="93%"
              innerRadius={84}
              outerRadius={116}
              paddingAngle={1}
              cornerRadius={3}
              stroke="var(--card)"
              strokeWidth={1.5}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.id} fill={toneColor(slice.tone)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="pointer-events-none absolute inset-x-0 top-[82px] flex flex-col items-center">
          <span className="text-muted-foreground text-xs">{centerLabel}</span>
          <span className="text-2xl font-medium tabular-nums">{centerValue}</span>
        </div>
      </div>

      <Separator className="my-5" />

      {/* The legend, and the numeric readout, in one row. */}
      <ul className="flex items-stretch">
        {slices.map((slice, index) => (
          <li key={slice.id} className="flex min-w-0 flex-1 items-stretch">
            {index > 0 ? <Separator orientation="vertical" className="mx-2" /> : null}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 px-2 text-center">
              <SliceTile slice={slice} />
              {/*
                `min-w-0 max-w-full` is load-bearing, not tidying. Without it
                this wrapper sizes to its content, so the `truncate` on the
                label below never engages and a long label overflows its column
                into the next one instead of ellipsing. Every story here fed it
                short words ("Paid", "Recurring"), so it took real feature names
                on the revenue mix to surface it — see `LongLabelsTruncate`.
              */}
              <div className="min-w-0 max-w-full">
                <div className="text-muted-foreground truncate text-xs">{slice.label}</div>
                <div className="text-base font-medium tabular-nums">{format(slice.value)}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
