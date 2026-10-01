import { Separator } from '@ui/components/primitives/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, seriesTone, toneRamp } from './charts'
import type { ChartTone } from './charts'

/**
 * `@reui/stats-14`'s segment matrix.
 *
 * The block draws a fixed grid of short slabs — `h-3 rounded`, a 2px gutter —
 * and encodes the value by how many of them are lit. The unlit remainder stays
 * on the track, so a short day is a short run of colour, not a shorter box.
 * The lit slabs step down one hue, `indigo-600` to `indigo-100` in the block;
 * here that ramp is mixed from the series tone so it still follows the theme.
 *
 * The block has a single series, so every slab in a column is the next step of
 * that ramp. A subscription day is several plans, and the footer has to say
 * which shade is which. Each series takes one step of the same ramp — the
 * first series the full tone, the next a step lighter — and its slabs stack
 * from the foot. Height is still the day's total; colour is which plan.
 */
export const PillColumnsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stats-14', 'ui/tooltip', 'ui/separator'],
  note: 'stats-14 slab grid over real columns. Each series takes one step of the block’s ramp and stacks from the foot; the footer is that ramp, labelled.',
})

/** One series across every column. Contributes to the totals and the footer. */
export interface PillSeries {
  /** Stable key, matched against `PillColumn.values`. */
  id: string
  /** Footer and tooltip label. */
  label: string
  /**
   * Which step of the ramp this series paints. Omit it and the series takes
   * the next step of the block's single hue, first series darkest.
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

/**
 * Slabs for one column, top to bottom.
 *
 * `lit` of them are coloured, the rest stay on the muted track above so the
 * run stands on the axis. The coloured ones are shared across the series in
 * proportion to their values (largest remainder, so they add up to `lit`),
 * and the first series sits at the foot.
 */
function columnSlabs(
  series: PillSeries[],
  values: Record<string, number>,
  lit: number,
  rows: number,
  colorAt: (index: number) => string | undefined,
): Array<string | null> {
  const amounts = series.map((item) => Math.max(values[item.id] ?? 0, 0))
  const total = amounts.reduce((sum, value) => sum + value, 0)
  const counts = amounts.map(() => 0)

  if (lit > 0 && total > 0) {
    const exact = amounts.map((value) => (value / total) * lit)
    const floors = exact.map((value) => Math.floor(value))
    let left = lit - floors.reduce((sum, value) => sum + value, 0)
    const order = exact
      .map((value, index) => ({ index, fraction: value - (floors[index] ?? 0) }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    for (const entry of order) {
      if (left <= 0) break
      floors[entry.index] = (floors[entry.index] ?? 0) + 1
      left -= 1
    }
    floors.forEach((count, index) => {
      counts[index] = count
    })
  }

  // Bottom-up: series 0 on the axis, then the next. Reverse into DOM order.
  const litColors: string[] = []
  counts.forEach((count, index) => {
    const color = colorAt(index)
    if (!color) return
    for (let step = 0; step < count; step += 1) litColors.push(color)
  })

  const muted = Math.max(rows - litColors.length, 0)
  return [...Array.from({ length: muted }, () => null), ...litColors.reverse()]
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
  // One step per series, darkest first — the block's indigo-600 … indigo-100,
  // mixed from the lead tone so a page can still recolour the whole matrix.
  const ramp = toneRamp(series[0]?.tone ?? seriesTone(0), Math.max(series.length, 1))
  const seriesColor = (index: number) => ramp[Math.min(index, ramp.length - 1)] ?? ramp[0]

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
          const slabs = columnSlabs(series, column.values, lit, rows, seriesColor)

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
                  {slabs.map((color, rowIndex) => (
                    <span
                      key={rowIndex}
                      aria-hidden="true"
                      /* The block's slab, to the pixel: 12px tall, 4px radius,
                         2px margin top and bottom for a 4px gutter. */
                      className={cn('my-0.5 h-3 rounded', color ? null : 'bg-muted')}
                      {...(color ? { style: { backgroundColor: color } } : {})}
                    />
                  ))}
                </TooltipTrigger>
                <TooltipContent side="top" className="px-2.5 py-2">
                  <div className="text-xs font-medium">{column.label}</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {series.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs">{item.label}</span>
                        <span className="text-xs font-medium tabular-nums">
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

      {series.length === 0 ? null : (
        <>
          <Separator />
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            {series.map((item, index) => {
              const total = columns.reduce(
                (sum, column) => sum + Math.max(column.values[item.id] ?? 0, 0),
                0,
              )
              return (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seriesColor(index) }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums">{format(total)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
