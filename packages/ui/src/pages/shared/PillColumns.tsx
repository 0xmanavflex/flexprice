import { Separator } from '@ui/components/primitives/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, seriesTone, toneRamp } from './charts'
import type { ChartTone } from './charts'

/**
 * `@reui/stats-14`'s segment matrix.
 *
 * The block is not a bar chart in the usual sense, and reading it as one is how
 * this component went wrong. It draws a **fixed grid** — every column the same
 * height, built from short slabs — and encodes the value by how many slabs are
 * *lit*. The unlit remainder stays visible as its own track, so each column
 * carries its own scale. The lit run steps down a single-hue ramp, full tone at
 * the head fading to almost nothing at the tail, which is what gives the block
 * its equaliser look.
 *
 * Two details come from the design rather than the block, and both matter:
 *
 * - **The bar grows from the bottom.** stats-14 lights from the top down, so a
 *   short column floats against the ceiling. Across a row of dates that reads
 *   as bars hanging rather than standing, and the design anchors them at the
 *   foot.
 * - **The ramp restarts at the head of each run** rather than being indexed by
 *   absolute row. A column with three lit slabs uses the first three steps, not
 *   the last three, so the top of every bar is the same full tone and the eye
 *   compares *heights* instead of being told the short days are also the pale
 *   ones.
 *
 * **Colour here is magnitude, not identity.** Every column runs the same ramp,
 * so nothing in the plot tells one series from another — which is why the
 * footer lists totals as text instead of a colour key. A single ramp cannot
 * encode both how many and which, and the breakdown reads better as numbers
 * anyway. The per-series split for a given column stays in the tooltip.
 */
export const PillColumnsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stats-14', 'ui/tooltip', 'ui/separator'],
  note: 'stats-14 segment matrix, bottom-anchored with the ramp restarting per bar, over real data, with a per-column tooltip and a text footer of series totals.',
})

/** One series across every column. Contributes to the totals and the footer. */
export interface PillSeries {
  /** Stable key, matched against `PillColumn.values`. */
  id: string
  /** Footer and tooltip label. */
  label: string
  /**
   * Override the ramp's base tone. Rarely wanted: the plot is single-hue, so
   * this recolours the whole matrix rather than one series. Only the first
   * series' tone is read.
   */
  tone?: ChartTone | undefined
}

/** One column: an x-axis category and its value per series. */
export interface PillColumn {
  /** Axis label under the column. Short — the design uses a bare day number. */
  label: string
  /** Value per series id. A missing id counts as zero. */
  values: Record<string, number>
}

export interface PillColumnsProps {
  columns: PillColumn[]
  /** The series making up each column, and the footer's order. */
  series: PillSeries[]
  /** Slabs in a column. Default 7, the design's. */
  rows?: number | undefined
  /** Formats values for the tooltip and footer. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the plot as a whole. */
  label: string
  className?: string | undefined
}

export function PillColumns({
  columns,
  series,
  rows = 7,
  format = formatWhole,
  label,
  className,
}: PillColumnsProps) {
  const ramp = toneRamp(series[0]?.tone ?? seriesTone(0), rows)

  const totals = columns.map((column) =>
    series.reduce((sum, item) => sum + Math.max(column.values[item.id] ?? 0, 0), 0),
  )
  const peak = totals.length > 0 ? Math.max(...totals) : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex w-full items-end gap-2" role="group" aria-label={label}>
        {columns.map((column, columnIndex) => {
          const total = totals[columnIndex] ?? 0
          /*
           * How many slabs this column lights, against the tallest column. A
           * column with any value at all lights one: rounding a real figure
           * down to an empty column is the one error a count must not make,
           * and the plot would then contradict its own tooltip.
           */
          const share = peak > 0 ? total / peak : 0
          const lit = share > 0 ? Math.max(1, Math.round(share * rows)) : 0
          const firstLit = rows - lit

          const reading = `${column.label}: ${format(total)} total, ${series
            .map((item) => `${item.label} ${format(column.values[item.id] ?? 0)}`)
            .join(', ')}`

          return (
            <div key={column.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={reading}
                      className="focus-visible:ring-ring flex w-full cursor-default flex-col justify-end rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  }
                >
                  {Array.from({ length: rows }, (_, rowIndex) => {
                    // Lit from the foot up; the ramp counts from the bar's head.
                    const isLit = rowIndex >= firstLit
                    return (
                      <span
                        key={rowIndex}
                        aria-hidden="true"
                        /* The block's slab, to the pixel: 12px tall, 4px
                           radius, 2px margin top and bottom for a 4px gutter. */
                        className={cn('my-0.5 h-3 rounded', isLit ? null : 'bg-muted')}
                        {...(isLit
                          ? { style: { backgroundColor: ramp[rowIndex - firstLit] } }
                          : {})}
                      />
                    )
                  })}
                </TooltipTrigger>
                <TooltipContent side="top" className="px-2.5 py-2">
                  <div className="text-xs font-semibold">{column.label}</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {series.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs">{item.label}</span>
                        <span className="text-xs font-semibold tabular-nums">
                          {format(column.values[item.id] ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>

              <span className="text-muted-foreground w-full truncate text-center text-xs">
                {column.label}
              </span>
            </div>
          )
        })}
      </div>

      {/*
        The footer, ruled off. Not a legend — there is no colour to key, since
        every column runs the same ramp — but the window's total per series,
        which is what the breakdown is actually being asked for.
      */}
      {series.length === 0 ? null : (
        <>
          <Separator />
          <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
            {series.map((item) => {
              const total = columns.reduce(
                (sum, column) => sum + Math.max(column.values[item.id] ?? 0, 0),
                0,
              )
              return (
                <li key={item.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold tabular-nums">{format(total)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
