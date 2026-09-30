import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { TrendBadge, formatWhole } from './charts'

/**
 * A row per thing, each with a segmented bar meter.
 *
 * `@reui/chart-14` draws its allocation figure as a run of 56 narrow rounded
 * uprights — filled ones in colour, the rest in `muted` — rather than a solid
 * progress bar. The block draws exactly one of those, for one hard-wired
 * portfolio figure, inside a card with tabs and an avatar stack. What is reused
 * here is the meter: the segment count, the `w-1` upright, the full-height
 * pill, the filled/track pairing. What is added is *rows* — the console always
 * has several features, plans or customers to compare, and the comparison is
 * the entire reason to draw a meter instead of printing the number.
 *
 * The segments are also what makes the rows comparable at a glance. Solid bars
 * of slightly different lengths are hard to rank; counting uprights is not.
 *
 * Two deviations from the block, both deliberate. Its trend delta is
 * `text-success` at 12px, which measures 2.95:1 against the card and fails —
 * `TrendBadge` puts that colour in a tinted fill behind dark text instead. And
 * its meter is a bare `role="img"`; here each track is a focusable tooltip
 * trigger, so the exact figure behind the approximation is reachable by
 * keyboard and not only by hovering a mouse over a 28px-tall strip.
 */
export const SegmentMeterProvenance = provenance({
  source: 'composition',
  composes: ['@reui/chart-14', 'ui/tooltip'],
  note: 'chart-14 segmented meter, one per row, over real values. Primary series tone; badge trend rather than the block failing-contrast coloured text.',
})

/** One row of the meter list. */
export interface SegmentMeterRow {
  /** Stable key. */
  id: string
  /** Row heading. */
  label: string
  /** Secondary line under the label — a lookup key, a plan, a unit. */
  caption?: string | undefined
  value: number
  /**
   * The denominator this row's track is full at.
   *
   * Omit it and every row is measured against the largest value in the list,
   * which is what you want when comparing features to each other. Give it when
   * the rows have a real ceiling — an entitlement, a quota — because then
   * "full" means something and the largest row may be nowhere near it.
   */
  max?: number | undefined
  /** The figure at the right, already formatted. Defaults to the formatted `value`. */
  display?: string | undefined
  /** Change against the previous window, as a percentage. */
  changePercent?: number | undefined
}

export interface SegmentMeterProps {
  rows: SegmentMeterRow[]
  /** Segments in a full track. Default 56, the block's. */
  segments?: number | undefined
  /** Formats values for the tooltip and the right-hand figure. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the list as a whole. */
  label: string
  /** Shown in place of the rows when there are none. */
  emptyMessage?: string | undefined
  className?: string | undefined
}

/** How many of `segments` a value fills, given its denominator. */
export function filledSegments(value: number, max: number, segments: number): number {
  if (max <= 0 || segments <= 0) return 0
  const share = Math.min(Math.max(value, 0) / max, 1)
  // A non-zero value always lights at least one segment: rounding a real
  // reading down to an empty track is how a meter says "none" about "some".
  return share > 0 ? Math.max(1, Math.round(share * segments)) : 0
}

/** The bare track. Shared with `SplitMeter`, which fills it with several tones. */
export function MeterTrack({
  filled,
  segments,
  className,
}: {
  filled: number
  segments: number
  className?: string | undefined
}) {
  return (
    <span className={cn('flex h-7 w-full items-stretch justify-between', className)}>
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'h-full w-1 shrink-0 rounded-full',
            index < filled ? 'bg-chart-1' : 'bg-muted',
          )}
        />
      ))}
    </span>
  )
}

export function SegmentMeter({
  rows,
  segments = 56,
  format = formatWhole,
  label,
  emptyMessage = 'Nothing to show for this period',
  className,
}: SegmentMeterProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'border-border text-muted-foreground flex min-h-24 items-center justify-center rounded-lg border border-dashed px-4 text-sm',
          className,
        )}
        role="status"
      >
        {emptyMessage}
      </div>
    )
  }

  const peak = Math.max(...rows.map((row) => Math.max(row.value, 0)), 0)

  return (
    <ul className={cn('flex flex-col gap-5', className)} aria-label={label}>
      {rows.map((row) => {
        const max = row.max ?? peak
        const filled = filledSegments(row.value, max, segments)
        const share = max > 0 ? Math.round((Math.min(row.value, max) / max) * 100) : 0
        const reading = `${row.label}: ${format(row.value)} of ${format(max)}, ${share}%`

        return (
          <li key={row.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{row.label}</span>
                {row.caption ? (
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {row.caption}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {row.display ?? format(row.value)}
                </span>
                {row.changePercent === undefined ? null : (
                  <TrendBadge percent={row.changePercent} />
                )}
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={reading}
                    className="focus-visible:ring-ring block w-full cursor-default rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  />
                }
              >
                <MeterTrack filled={filled} segments={segments} />
              </TooltipTrigger>
              <TooltipContent side="top" className="px-2.5 py-1.5 text-xs">
                {reading}
              </TooltipContent>
            </Tooltip>
          </li>
        )
      })}
    </ul>
  )
}
