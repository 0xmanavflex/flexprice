import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, seriesTone, toneColor } from './charts'
import type { ChartTone } from './charts'

/**
 * Stacked columns, drawn as stacked pills.
 *
 * `@reui/stats-14` draws a column as a run of small rounded segments rather
 * than a solid bar, lit from the bottom. The block hard-wires one series of
 * indigo bars with its numbers in a `data.ts`; what is reused here is the
 * *mark* — the segment stack, its rounding and its spacing — over real
 * multi-series data, with each segment taking the tone of the series it belongs
 * to so one column reads as a stack.
 *
 * The pill quantises, and that is the point. A solid stacked bar invites you to
 * compare two segments by eyeballing their heights; a pill stack gives you
 * something countable, and is honest that these are approximate shares rather
 * than a precise readout. The precise numbers are in the tooltip and the
 * legend, where they can be read rather than estimated.
 */
export const PillColumnsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stats-14', 'ui/tooltip'],
  note: 'stats-14 pill-segment column over real stacked series, tones from the validated palette, per-column tooltip.',
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
  /** Stack order, bottom first. Also the legend order. */
  series: PillSeries[]
  /** Segments in a full column. Default 8. */
  cells?: number | undefined
  /** Column height in px. Default 160. */
  height?: number | undefined
  /** Formats values for the tooltip and legend. Defaults to a locale-grouped integer. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the plot as a whole. */
  label: string
  className?: string | undefined
}

/**
 * Hand out `slots` whole segments in proportion to `values`.
 *
 * Largest-remainder, so the parts sum to exactly `slots` — rounding each share
 * independently drifts, and a column that shows seven segments when it should
 * show eight is a bug somebody will chase through the data instead of the
 * arithmetic. A series with any value at all takes a segment before the
 * remainders are shared out, so a small-but-real share is never invisible.
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
  cells = 8,
  height = 160,
  format = formatWhole,
  label,
  className,
}: PillColumnsProps) {
  const toneFor = (index: number): ChartTone => series[index]?.tone ?? seriesTone(index)

  const totals = columns.map((column) =>
    series.reduce((sum, item) => sum + Math.max(column.values[item.id] ?? 0, 0), 0),
  )
  const peak = totals.length > 0 ? Math.max(...totals) : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-end gap-2" role="group" aria-label={label}>
        {columns.map((column, columnIndex) => {
          const total = totals[columnIndex] ?? 0
          // How tall this column stands, in whole segments, against the tallest.
          const filled = peak > 0 ? (allocate([total, peak - total], cells)[0] ?? 0) : 0
          const perSeries = allocate(
            series.map((item) => Math.max(column.values[item.id] ?? 0, 0)),
            filled,
          )

          // Bottom-up: index 0 is the lowest segment, so the first series sits
          // at the foot of the stack the way a stacked bar reads.
          const stack: (ChartTone | null)[] = Array.from({ length: cells }, () => null)
          let cursor = 0
          perSeries.forEach((count, seriesIndex) => {
            for (let n = 0; n < count && cursor < cells; n += 1) {
              stack[cursor] = toneFor(seriesIndex)
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
                      className="focus-visible:ring-ring flex w-full cursor-default flex-col-reverse gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      style={{ height }}
                    />
                  }
                >
                  {stack.map((tone, cellIndex) => (
                    <span
                      key={cellIndex}
                      aria-hidden="true"
                      className={cn('min-h-0 w-full flex-1 rounded-full', tone ? null : 'bg-muted')}
                      {...(tone ? { style: { backgroundColor: toneColor(tone) } } : {})}
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
       * Always drawn, never conditional on there being room: with more than one
       * series the only other thing telling them apart is their colour, and a
       * legend that disappears on a narrow screen takes the meaning with it.
       */}
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
    </div>
  )
}
