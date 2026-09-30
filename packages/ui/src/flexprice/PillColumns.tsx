import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, seriesTone, toneColor, toneRamp } from './charts'
import type { ChartTone } from './charts'

/**
 * `@reui/stats-14`'s segment matrix, over real data.
 *
 * The block is not a bar chart, and reading it as one is how this component
 * went wrong the first time. It draws a **fixed grid** — every column is the
 * same height, built from `rows` short slabs — and encodes the value by how
 * many slabs are *lit*, counting down from the top. The unlit remainder stays
 * visible underneath as `bg-muted`, so each column carries its own track. The
 * lit slabs run a single-hue ramp by row, dark at the top to pale at the
 * bottom, which is what gives the block its equaliser look.
 *
 * What is reused is that mark, exactly: the `h-3` slab, its `rounded` corners,
 * the `my-0.5` that puts 4px between slabs, `gap-2` between columns, the
 * top-down fill and the graduated ramp. The first version of this file reused
 * none of it — it drew variable-height stacks of `rounded-full` pills, bottom
 * anchored, in flat categorical colour — and the result looked nothing like
 * the block it claimed to compose.
 *
 * **Colour means one thing at a time.** With a single series the ramp is the
 * block's, sequential by row. With several it cannot be: painting plans by row
 * index would say the top of a column is a different *kind* of thing from the
 * bottom, when what actually differs is which plan. So multi-series columns
 * take a flat categorical tone per series and the ramp stands down. The
 * geometry — which is what you recognise — is identical either way.
 *
 * Three things the block has no need of, kept because a console does: the
 * axis label under each column, a tooltip carrying the exact figures, and a
 * legend. The matrix quantises, deliberately — it is countable rather than
 * precise — so the precise numbers have to be somewhere, and hover is not
 * somewhere a keyboard can reach.
 */
export const PillColumnsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stats-14', 'ui/tooltip'],
  note: 'stats-14 segment matrix — h-3 slabs, top-down fill, graduated ramp — over real data, with an axis, a tooltip and a legend.',
})

/** One series across every column. */
export interface PillSeries {
  /** Stable key, matched against `PillColumn.values`. */
  id: string
  /** Legend and tooltip label. */
  label: string
  /**
   * Override the tone. Omit it and the series takes its categorical slot from
   * its position, which is what keeps colour meaning the same thing across
   * every chart on the page.
   */
  tone?: ChartTone | undefined
}

/** One column: an x-axis category and its value per series. */
export interface PillColumn {
  /** Axis label under the column. */
  label: string
  /** Value per series id. A missing id counts as zero. */
  values: Record<string, number>
}

export interface PillColumnsProps {
  columns: PillColumn[]
  /** Stack order, top first — the order the legend reads in. */
  series: PillSeries[]
  /** Slabs in a column. Default 6, the block's. */
  rows?: number | undefined
  /** Formats values for the tooltip and legend. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the plot as a whole. */
  label: string
  className?: string | undefined
}

/**
 * Hand out `slots` whole slabs in proportion to `values`.
 *
 * Largest-remainder, so the parts sum to exactly `slots` — rounding each share
 * independently drifts, and a column that shows five slabs when it should show
 * six is a bug somebody will chase through the data instead of the arithmetic.
 * A series with any value at all takes a slab before the remainders are shared
 * out, so a small-but-real share is never invisible.
 */
function allocate(values: number[], slots: number): number[] {
  const out = values.map(() => 0)
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  if (total <= 0 || slots <= 0) return out

  const exact = values.map((value) => (Math.max(value, 0) / total) * slots)
  exact.forEach((value, index) => {
    out[index] = Math.floor(value)
  })
  let used = out.reduce((sum, value) => sum + value, 0)

  for (let index = 0; index < values.length && used < slots; index += 1) {
    if ((values[index] ?? 0) > 0 && out[index] === 0) {
      out[index] = 1
      used += 1
    }
  }

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)

  let cursor = 0
  while (used < slots && byRemainder.length > 0) {
    const entry = byRemainder[cursor % byRemainder.length]
    if (entry) {
      out[entry.index] = (out[entry.index] ?? 0) + 1
      used += 1
    }
    cursor += 1
  }

  return out
}

export function PillColumns({
  columns,
  series,
  rows = 6,
  format = formatWhole,
  label,
  className,
}: PillColumnsProps) {
  const toneFor = (index: number): ChartTone => series[index]?.tone ?? seriesTone(index)

  /*
   * One series is the block's own case, so it gets the block's own treatment:
   * a ramp down the rows. Several series means colour is already spoken for.
   */
  const single = series.length <= 1
  const ramp = single ? toneRamp(series[0]?.tone ?? seriesTone(0), rows) : null

  const totals = columns.map((column) =>
    series.reduce((sum, item) => sum + Math.max(column.values[item.id] ?? 0, 0), 0),
  )
  const peak = totals.length > 0 ? Math.max(...totals) : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex w-full items-end gap-2" role="group" aria-label={label}>
        {columns.map((column, columnIndex) => {
          const total = totals[columnIndex] ?? 0
          // How many slabs this column lights, against the tallest column.
          const lit = peak > 0 ? (allocate([total, peak - total], rows)[0] ?? 0) : 0

          /*
           * Which series owns each lit slab, top down. `null` is unlit track.
           * Series 0 takes the top of the column so the stack reads in the
           * same order as the legend beneath it.
           */
          const owner: (number | null)[] = Array.from({ length: rows }, () => null)
          const perSeries = allocate(
            series.map((item) => Math.max(column.values[item.id] ?? 0, 0)),
            lit,
          )
          let cursor = 0
          perSeries.forEach((count, seriesIndex) => {
            for (let n = 0; n < count && cursor < rows; n += 1) {
              owner[cursor] = seriesIndex
              cursor += 1
            }
          })

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
                  {owner.map((seriesIndex, rowIndex) => (
                    <span
                      key={rowIndex}
                      aria-hidden="true"
                      /* The block's slab, to the pixel: 12px tall, 4px radius,
                         2px of margin top and bottom for a 4px gutter. */
                      className={cn(
                        'my-0.5 h-3 rounded',
                        seriesIndex === null ? 'bg-muted' : null,
                      )}
                      {...(seriesIndex === null
                        ? {}
                        : {
                            style: {
                              backgroundColor: ramp
                                ? (ramp[rowIndex] ?? toneColor(toneFor(seriesIndex)))
                                : toneColor(toneFor(seriesIndex)),
                            },
                          })}
                    />
                  ))}
                </TooltipTrigger>
                <TooltipContent side="top" className="px-2.5 py-2">
                  <div className="text-xs font-semibold">{column.label}</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {series.map((item, seriesIndex) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{ backgroundColor: toneColor(toneFor(seriesIndex)) }}
                          />
                          {item.label}
                        </span>
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
       * Drawn whenever colour is carrying identity — which is exactly the
       * multi-series case. A single series is already named by the panel's own
       * title, and the ramp there is magnitude, not identity, so a legend
       * mapping one colour to one label would be noise.
       */}
      {single ? null : (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((item, seriesIndex) => (
            <li key={item.id} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: toneColor(toneFor(seriesIndex)) }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
