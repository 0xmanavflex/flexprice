import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole } from './charts'

/**
 * A row per thing, each with a segmented bar meter.
 *
 * `@reui/chart-14` draws its allocation figure as a run of 56 narrow rounded
 * uprights: filled ones in colour, the rest in `muted`: rather than a solid
 * progress bar. The block draws exactly one of those, for one hard-wired
 * portfolio figure, inside a card with tabs and an avatar stack. What is reused
 * here is the meter: the segment count, the `w-1` upright, the full-height
 * pill, the filled/track pairing. What is added is *rows*: the console always
 * has several features, plans or customers to compare, and the comparison is
 * the entire reason to draw a meter instead of printing the number.
 *
 * The block draws that meter once, under a single figure. A usage list repeats
 * it: the name and its key on the left, the track in the middle, the figure
 * and the block's delta on the right. The delta keeps the block's classes:
 * `text-xs font-medium` in `text-success` or `text-destructive`: and each
 * track is a focusable tooltip trigger so the exact figure is reachable by
 * keyboard.
 */
export const SegmentMeterProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'chart-14 segmented meter, one per row: label, track, figure, and the block’s coloured delta. Lineage: @reui/chart-14.',
})

/** One row of the meter list. */
export interface SegmentMeterRow {
  /** Stable key. */
  id: string
  /** Row heading. */
  label: string
  /** Secondary line under the label: a lookup key, a plan, a unit. */
  caption?: string | undefined
  value: number
  /**
   * The denominator this row's track is full at.
   *
   * Omit it and every row is measured against the largest value in the list,
   * which is what you want when comparing features to each other. Give it when
   * the rows have a real ceiling: an entitlement, a quota: because then
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
  /** Segments in a full track. Default 48, the reference's. */
  segments?: number | undefined
  /** Formats values for the tooltip and the right-hand figure. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the list as a whole. */
  label: string
  /** Shown in place of the rows when there are none. */
  emptyMessage?: string | undefined
  className?: string | undefined
}

/** chart-14's delta: coloured 12px text, sign included, no badge. */
function MeterDelta({ percent }: { percent: number }) {
  const positive = percent >= 0
  const formatted = `${positive ? '+' : ''}${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(percent)}%`

  return (
    <span className={cn('text-xs tabular-nums', positive ? 'text-success' : 'text-destructive')}>
      {formatted}
    </span>
  )
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
  fill = 'bg-blue-600 dark:bg-blue-500',
  className,
}: {
  filled: number
  segments: number
  /** The filled segments' colour, as a `bg-*` class: a status meter turns amber or red. */
  fill?: string
  className?: string | undefined
}) {
  return (
    <span
      className={cn('flex h-6 w-full min-w-0 items-stretch justify-between gap-0.5', className)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'h-full max-w-1 min-w-0.5 flex-1 rounded-full',
            index < filled ? fill : 'bg-muted',
          )}
        />
      ))}
    </span>
  )
}

export function SegmentMeter({
  rows,
  segments = 48,
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
    <ul className={cn('divide-border/50 flex flex-col divide-y', className)} aria-label={label}>
      {rows.map((row) => {
        const max = row.max ?? peak
        const filled = filledSegments(row.value, max, segments)
        const share = max > 0 ? Math.round((Math.min(row.value, max) / max) * 100) : 0
        const reading = `${row.label}: ${format(row.value)} of ${format(max)}, ${share}%`

        return (
          <li
            key={row.id}
            className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-x-6 py-4"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{row.label}</div>
              {row.caption ? (
                <div className="text-muted-foreground truncate font-mono text-[11px]">
                  {row.caption}
                </div>
              ) : null}
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

            <div className="flex shrink-0 items-baseline gap-3">
              <span className="text-[13px] whitespace-nowrap tabular-nums">
                {row.display ?? format(row.value)}
              </span>
              {row.changePercent === undefined ? null : <MeterDelta percent={row.changePercent} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
