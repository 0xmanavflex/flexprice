import { Separator } from '@ui/components/primitives/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, toneColor } from './charts'
import type { ChartTone } from './charts'

/**
 * `@reui/stats-14`'s segment matrix.
 *
 * The block draws a fixed grid of short slabs: `h-3 rounded`, a 2px gutter:
 * and encodes the value by how many of them are lit. The unlit remainder stays
 * on the track, so a short day is a short run of colour, not a shorter box.
 * The lit slabs step down one hue, `indigo-600` to `indigo-100` in the block;
 * here that ramp is mixed from the series tone so it still follows the theme.
 *
 * The block has a single series, so every slab in a column is the next step of
 * that ramp. A subscription day is several plans, and the footer has to say
 * which shade is which. Each series takes one step of the same ramp: the
 * first series the full tone, the next a step lighter: and its slabs stack
 * from the foot. Height is still the day's total; colour is which plan.
 */
export const PillColumnsProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip', 'ui/separator'],
  note: 'stats-14 slab grid over real columns. Each series takes one step of the block’s ramp and stacks from the foot; the footer is that ramp, labelled. Lineage: @reui/stats-14.',
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
  /** Axis label under the column. Short: the design uses a bare day number. */
  label: string
  /** Value per series id. A missing id counts as zero. */
  values: Record<string, number>
}

/**
 * Slabs for one column, top to bottom.
 *
 * `lit` of them are coloured and they sit at the *foot*, so the bar stands on
 * the axis with the muted track above it. The ramp is indexed by position
 * within the lit run, counted from its head: so the top slab of every bar is
 * the full tone no matter how tall the bar is, and the shade fades downward.
 *
 * That is the design's mark, and it is not the same as colouring by series.
 * Keying the ramp to the series index makes a short column uniformly dark and
 * a tall one uniformly spread, so height and colour say the same thing twice
 * and the heads of two bars no longer match. `BarsStandAndTheRampRestarts`
 * pins both halves; it failed when this was keyed to the series.
 *
 * Colour therefore carries magnitude, not identity. Which series contributed
 * what is in the tooltip and in the footer totals, where it can be read
 * instead of decoded.
 */
function columnSlabs(lit: number, rows: number, ramp: string[]): Array<string | null> {
  const run = Math.min(Math.max(lit, 0), rows)
  const muted = rows - run
  return [
    ...Array.from({ length: muted }, () => null),
    ...Array.from({ length: run }, (_, index) => ramp[index] ?? ramp[ramp.length - 1] ?? null),
  ]
}

/** The reference's seven opacity steps, full tone down to 16%. */
const RAMP_OPACITY = [100, 85, 70, 55, 40, 28, 16]

/**
 * One tone stepped down by opacity: the reference's `bg-blue-600` to
 * `bg-blue-600/16`. Seven rows use its exact steps; any other row count
 * interpolates between the same ends.
 */
function opacityRamp(base: string, steps: number): string[] {
  return Array.from({ length: steps }, (_, index) => {
    const weight =
      steps === RAMP_OPACITY.length
        ? (RAMP_OPACITY[index] ?? 16)
        : steps <= 1
          ? 100
          : Math.round(100 - (84 * index) / (steps - 1))
    return weight >= 100 ? base : `color-mix(in oklab, ${base} ${weight}%, transparent)`
  })
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
  /** Plan names and counts under the chart. Off when the card should not name them. */
  legend?: boolean | undefined
  className?: string | undefined
}

export function PillColumns({
  columns,
  series,
  rows = 7,
  format = formatWhole,
  label,
  legend = true,
  className,
}: PillColumnsProps) {
  // One step per row, from the lead tone, so a page can still recolour the
  // whole matrix. Sized to `rows`, not to the series count, because the ramp is
  // read down a bar. Defaults to the reference's blue.
  const lead = series[0]?.tone
  const ramp = opacityRamp(lead ? toneColor(lead) : 'var(--color-blue-600)', rows)

  const totals = columns.map((column) =>
    series.reduce((sum, item) => sum + Math.max(column.values[item.id] ?? 0, 0), 0),
  )
  const peak = totals.length > 0 ? Math.max(...totals) : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex min-h-32 w-full items-end gap-2" role="group" aria-label={label}>
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
          const slabs = columnSlabs(lit, rows, ramp)

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
                      className="focus-visible:ring-ring flex w-full cursor-default flex-col justify-end gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  }
                >
                  {slabs.map((color, rowIndex) => (
                    <span
                      key={rowIndex}
                      aria-hidden="true"
                      /* The reference's slab: 12px tall, 4px radius, a 4px gutter
                         from the column's `gap-1`. */
                      className={cn('h-3 rounded', color ? null : 'bg-muted/70')}
                      {...(color ? { style: { backgroundColor: color } } : {})}
                    />
                  ))}
                </TooltipTrigger>
                <TooltipContent side="top" className="flex-col items-stretch gap-1.5 px-3 py-2">
                  <div className="text-xs font-medium">{column.label}</div>
                  <div className="flex flex-col gap-1">
                    {series.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(8rem,1fr)_auto] items-baseline gap-4"
                      >
                        <span className="text-xs">{item.label}</span>
                        <span className="text-xs font-medium tabular-nums">
                          {format(column.values[item.id] ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>

              <span className="text-muted-foreground w-full truncate text-center text-[11px]">
                {column.label}
              </span>
            </div>
          )
        })}
      </div>

      {!legend || series.length === 0 ? null : (
        <>
          <Separator />
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            {series.map((item) => {
              const total = columns.reduce(
                (sum, column) => sum + Math.max(column.values[item.id] ?? 0, 0),
                0,
              )
              return (
                /* No swatch. Every column runs the same ramp, so a dot here
                   would key a colour that does not distinguish anything in the
                   plot: it would read as "Studio is the dark blue one" when
                   the dark blue is simply the top of each bar. */
                <li key={item.id} className="flex items-baseline gap-2 text-sm">
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
