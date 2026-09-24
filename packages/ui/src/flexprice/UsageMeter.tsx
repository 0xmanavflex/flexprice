import { Progress, ProgressIndicator, ProgressTrack } from '@ui/primitives/progress'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Usage against an entitlement.
 *
 * Three states that a plain progress bar gets wrong:
 *
 * - **Unlimited.** Not 100%, and not 0% — there is no denominator, so a bar is
 *   the wrong shape entirely and it says so in words instead.
 * - **Over the limit.** The bar caps at full but the number keeps counting, so
 *   "1,200 of 1,000" stays readable rather than silently clamping.
 * - **Zero allowance.** Dividing by it is how you get `NaN%` on screen.
 *
 * (An earlier version used a bare `progress` element; it is ReUI's Progress now,
 * so the track and indicator theme from the same tokens as everything else.)
 *
 * Built on ReUI's Progress rather than a styled div or a bare `<progress>`, so
 * the track and indicator are themed from the same tokens as everything else
 * and the accessible semantics come with it.
 */
export const UsageMeterProvenance = provenance({
  source: 'custom',
  reason:
    'Entitlement usage has an unlimited case and an over-limit case that no generic progress component models. ReUI has no equivalent.',
})

export interface UsageMeterProps {
  label: string
  used: number
  /** null means unlimited — not zero, and not infinity. */
  limit: number | null
  unit?: string
  locale?: string
}

export function UsageMeter({ label, used, limit, unit, locale }: UsageMeterProps) {
  const format = (value: number) => new Intl.NumberFormat(locale).format(value)
  const unlimited = limit === null
  const exhausted = !unlimited && limit === 0
  const over = !unlimited && !exhausted && used > limit
  const percent = unlimited || exhausted ? 0 : Math.min(100, Math.round((used / limit) * 100))

  const summary = unlimited
    ? `${format(used)}${unit ? ` ${unit}` : ''} used of unlimited`
    : `${format(used)} of ${format(limit)}${unit ? ` ${unit}` : ''}`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn('text-xs tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}
        >
          {summary}
        </span>
      </div>

      {unlimited ? (
        <p className="text-xs text-muted-foreground">Unlimited</p>
      ) : (
        <Progress
          value={percent}
          aria-label={`${label}: ${summary}`}
          className="h-1.5"
        >
          <ProgressTrack className="bg-muted h-1.5 rounded-full">
            <ProgressIndicator
              className={cn('h-full rounded-full', over ? 'bg-destructive' : 'bg-primary')}
            />
          </ProgressTrack>
        </Progress>
      )}

      {over ? (
        <p className="text-xs text-destructive">
          Over the included amount by {format(used - (limit ?? 0))}
        </p>
      ) : null}
    </div>
  )
}
