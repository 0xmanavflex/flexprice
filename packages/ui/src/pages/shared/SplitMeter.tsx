import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { formatWhole, seriesTone, toneColor } from './charts'
import type { ChartTone } from './charts'

/**
 * `@reui/chart-14`'s meter, carrying several coloured parts in one track.
 *
 * The block's meter is two-state: a segment is either filled or it is track.
 * That answers "how much of the whole", which is the only question a single
 * figure can raise. The console keeps asking a second one: *how the whole
 * divides*: revenue by plan, usage by feature, a balance between what is
 * committed and what is left. Extending the same mark rather than reaching for
 * a stacked bar keeps one idiom on the page, so a reader who has learned to
 * count uprights in one panel can read the next one without relearning it.
 *
 * `total` is what separates this from a pie. Given one, the unfilled remainder
 * is drawn as track and the parts are shares *of the ceiling*: how much of a
 * commitment is used, with the rest still to come. Omitted, the parts fill the
 * track and are shares of each other. Those are different claims, and a
 * component that guessed between them would be wrong half the time.
 *
 * Segment allocation is largest-remainder, so the parts sum to exactly the
 * filled count, and any part with a non-zero value takes at least one segment.
 * A part that exists but cannot be seen is worse than a rounding error.
 */
export const SplitMeterProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'chart-14 segmented meter extended to several tones in one track, with a legend and a per-part tooltip. Lineage: @reui/chart-14.',
})

/** One coloured part of the track. */
export interface SplitMeterPart {
  /** Stable key. */
  id: string
  /** Legend and tooltip label. */
  label: string
  value: number
  /**
   * Which token paints it. Omit it and the part takes its categorical slot from
   * its position; pass a status tone when the parts are *states* rather than
   * categories.
   */
  tone?: ChartTone | undefined
}

export interface SplitMeterProps {
  /** The parts, in track order, left to right. */
  parts: SplitMeterPart[]
  /**
   * The reading the track is full at.
   *
   * Omitted, the parts fill the track and read as shares of each other. Given,
   * anything left over is drawn as unfilled track: the parts are then shares
   * of a ceiling, and the gap is the point.
   */
  total?: number | undefined
  /** Segments in a full track. Default 48, the reference's. */
  segments?: number | undefined
  /** Heading above the track. */
  title?: ReactNode | undefined
  /** The figure beside the heading, already formatted. */
  value?: ReactNode | undefined
  /** Formats part values for the legend and tooltip. */
  format?: ((value: number) => string) | undefined
  /** Accessible name for the meter. */
  label: string
  className?: string | undefined
}

/**
 * Hand out `slots` whole segments in proportion to `values`, summing exactly.
 *
 * Same arithmetic as `PillColumns`, and deliberately duplicated rather than
 * hoisted into a shared helper module: it is nine lines, and the two callers
 * quantise different things (columns against a peak, a track against a total).
 * A shared "allocate" that both bend to fit is how a helper grows options.
 */
function allocate(values: number[], slots: number): number[] {
  const out = values.map(() => 0)
  const sum = values.reduce((acc, value) => acc + Math.max(value, 0), 0)
  if (sum <= 0 || slots <= 0) return out

  const exact = values.map((value) => (Math.max(value, 0) / sum) * slots)
  exact.forEach((value, index) => {
    out[index] = Math.floor(value)
  })
  let used = out.reduce((acc, value) => acc + value, 0)

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

export function SplitMeter({
  parts,
  total,
  segments = 48,
  title,
  value,
  format = formatWhole,
  label,
  className,
}: SplitMeterProps) {
  const toneFor = (index: number): ChartTone => parts[index]?.tone ?? seriesTone(index)

  const sum = parts.reduce((acc, part) => acc + Math.max(part.value, 0), 0)
  const ceiling = total ?? sum
  // With a ceiling above the sum, the shortfall stays as unfilled track.
  const filled =
    ceiling > 0
      ? (allocate([Math.min(sum, ceiling), Math.max(ceiling - sum, 0)], segments)[0] ?? 0)
      : 0
  const perPart = allocate(
    parts.map((part) => Math.max(part.value, 0)),
    filled,
  )

  // Left to right: part 0 starts the track.
  const track: (number | null)[] = Array.from({ length: segments }, () => null)
  let cursor = 0
  perPart.forEach((count, partIndex) => {
    for (let n = 0; n < count && cursor < segments; n += 1) {
      track[cursor] = partIndex
      cursor += 1
    }
  })

  const reading = `${label}: ${parts
    .map((part) => `${part.label} ${format(part.value)}`)
    .join(', ')}${total === undefined ? '' : ` of ${format(ceiling)}`}`

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {title === undefined && value === undefined ? null : (
        <div className="flex items-baseline gap-2">
          {value === undefined ? null : (
            <span className="text-4xl font-medium tabular-nums">{value}</span>
          )}
          {title === undefined ? null : (
            <span className="text-muted-foreground text-xs">{title}</span>
          )}
        </div>
      )}

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
          <span className="flex h-6 w-full min-w-0 items-stretch justify-between gap-0.5">
            {track.map((partIndex, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  'h-full max-w-1 min-w-0.5 flex-1 rounded-full',
                  partIndex === null ? 'bg-muted' : null,
                )}
                {...(partIndex === null
                  ? {}
                  : { style: { backgroundColor: toneColor(toneFor(partIndex)) } })}
              />
            ))}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="px-2.5 py-2">
          <div className="flex flex-col gap-1">
            {parts.map((part, partIndex) => (
              <div key={part.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: toneColor(toneFor(partIndex)) }}
                  />
                  {part.label}
                </span>
                <span className="text-xs font-medium tabular-nums">{format(part.value)}</span>
              </div>
            ))}
            {total === undefined ? null : (
              <div className="border-border mt-0.5 flex items-center justify-between gap-3 border-t pt-1">
                <span className="text-xs">Total</span>
                <span className="text-xs font-medium tabular-nums">{format(ceiling)}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Always present: several tones in one track is exactly the case where
          colour would otherwise be the only thing carrying identity. */}
      <ul className="divide-border/60 flex flex-col divide-y border-t">
        {parts.map((part, partIndex) => (
          <li key={part.id} className="flex items-center gap-3 py-3.5 text-[13px]">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: toneColor(toneFor(partIndex)) }}
            />
            <span className="flex-1">{part.label}</span>
            {ceiling > 0 ? (
              <span className="text-muted-foreground w-12 text-xs tabular-nums">
                {Math.round((Math.max(part.value, 0) / ceiling) * 100)}%
              </span>
            ) : null}
            <span className="font-medium tabular-nums">{format(part.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
