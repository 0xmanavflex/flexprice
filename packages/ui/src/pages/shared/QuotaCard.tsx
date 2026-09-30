import { useId, type CSSProperties, type ReactNode } from 'react'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Progress } from '@ui/components/primitives/progress'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { toneColor } from './charts'

/**
 * One entitled feature's quota, as a card.
 *
 * `@reui/stats-11` is an "API Call Quota" card, and its slots happen to be
 * exactly the six readings a customer's entitlement has: a `used` figure and a
 * cost on one row, a progress bar under them, what is left beside what is
 * included, and the renewal date in a divided footer. What is reused is that
 * arrangement — which reading sits where, and the fact that the denominator is
 * a quiet caption rather than a second headline.
 *
 * The block itself cannot be mounted: it exports a propless component bound to
 * its own `./data`, so this composes over its structure and takes every figure
 * as a prop, per `docs/component-guardrails.md` §2.
 *
 * Three deviations from the block, all forced:
 *
 * - **`included: null` is UNLIMITED, not zero.** The block always has a
 *   denominator. An entitlement need not, and `?? 0` would render "0 of 0" for
 *   something with no cap at all. With no denominator there is no percentage
 *   and no bar, so neither is drawn — a full bar and an empty bar are both
 *   lies about an uncapped feature.
 * - **The block's green "3000 free calls left" is a `success-light` Badge.**
 *   `text-success` as small foreground text measures 2.95:1, which fails; the
 *   light badge variants put the tint behind dark text and pass.
 * - **The cost slot is labelled "Overage" and renders `—`.** Nothing in the API
 *   prices a per-feature overage, and `money.ts` forbids computing one here. A
 *   card that filled that slot with a plausible figure would be the exact
 *   failure this repo spent a day removing. The block leaves its "$4.00"
 *   unlabelled, which a demo can afford; an unlabelled dash cannot, so the slot
 *   says what is missing even when it has nothing to show.
 *
 * Fully controlled and presentational: every figure arrives as a prop, and any
 * prop left `undefined` renders the dash with its reason rather than a zero.
 */
export const QuotaCardProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stats-11', 'ui/progress', 'ui/badge', 'pages/shared/charts'],
  note: "stats-11's quota-card arrangement over a real entitlement: used / included / percent / remaining / reset, with unlimited and over-quota states the block does not model and an unpriced overage slot that stays a dash.",
})

/** The dash a reading takes when there is nothing true to put there. */
const NOTHING = '—'

export interface QuotaCardAction {
  label: string
  onClick: () => void
}

export interface QuotaCardProps {
  /** The feature's name — the card's heading. */
  feature: string
  /**
   * Accessible name for the meter, read as a sentence fragment: the reading is
   * appended to it, so "API calls this period" becomes "API calls this period:
   * 2,000 of 5,000 used (40%)".
   */
  label: string
  /** The unit, plural — "API calls", "tokens". Folded into every reading. */
  unit?: string | undefined
  /** Used in the current period. `undefined` when nothing measures it. */
  used?: number | undefined
  /**
   * What the entitlement includes.
   *
   * `null` means **unlimited** — not zero, and not infinity. `undefined` means
   * no source reported a cap at all, which is a different claim again.
   */
  included?: number | null | undefined
  /**
   * The percentage the API itself reported, 0–100.
   *
   * Preferred over dividing here, so the card and the API cannot disagree about
   * rounding. Omitted, it is derived from `used` and `included` when both are
   * known and there is a non-zero denominator.
   */
  percentUsed?: number | undefined
  /** How often the allowance resets, as a word — "Monthly". Captions the denominator. */
  resetPeriodLabel?: string | undefined
  /** When the allowance next resets. `undefined`/`null` renders the dash. */
  resetsOn?: Date | null | undefined
  /**
   * What the overage has been charged at, already formatted (a `<Money>`).
   *
   * There is no endpoint for this today, so it is normally omitted and the slot
   * renders a dash. It is a prop rather than a hardcoded dash so that the day an
   * API prices an overage, this card does not have to change shape.
   */
  overage?: ReactNode | undefined
  /**
   * Why the overage slot is empty, as a sentence under the card.
   *
   * No default, because a grid of these would otherwise repeat one sentence
   * once per card. The slot is labelled "Overage" either way, so an unexplained
   * dash still says *what* is missing; a caller showing a single card passes
   * this, and a caller showing a grid says it once beneath the grid instead.
   */
  overageNote?: string | undefined
  /** The footer action — "View usage". */
  action?: QuotaCardAction | undefined
  locale?: string | undefined
  className?: string | undefined
}

export function QuotaCard({
  feature,
  label,
  unit,
  used,
  included,
  percentUsed,
  resetPeriodLabel,
  resetsOn,
  overage,
  overageNote,
  action,
  locale,
  className,
}: QuotaCardProps) {
  const headingId = useId()
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  const withUnit = (value: number) => `${format(value)}${unit ? ` ${unit}` : ''}`

  const unlimited = included === null
  // A denominator of zero is not a denominator. Dividing by it is how "NaN%"
  // reaches a billing screen.
  const measurable = typeof included === 'number' && included > 0 && typeof used === 'number'

  const percent = (() => {
    if (unlimited || included === undefined) return undefined
    if (percentUsed !== undefined) return Math.max(0, percentUsed)
    if (!measurable) return undefined
    return ((used as number) / (included as number)) * 100
  })()

  // Capped for the bar, uncapped for the reading — 120% must still say 120%.
  const barValue = percent === undefined ? 0 : Math.min(100, percent)
  const over = measurable && (used as number) > (included as number)

  const remaining = measurable ? Math.max(0, (included as number) - (used as number)) : undefined
  const overBy = over ? (used as number) - (included as number) : undefined

  // The bar signals state, so it takes a status token when it is over quota and
  // a categorical one otherwise. Never a colour from the call site.
  const tone = over ? 'critical' : 'series-1'

  // The whole reading, as one sentence fragment — the meter's accessible name.
  const meterName = `${label}: ${
    typeof used === 'number' ? withUnit(used) : 'an unreported amount'
  } of ${typeof included === 'number' ? format(included) : 'an unreported allowance'} used${
    percent === undefined ? '' : ` (${format(Math.round(percent))}%)`
  }`

  return (
    <section
      aria-labelledby={headingId}
      className={cn('bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4', className)}
    >
      {/* Header: the feature, and the way out to its detail. */}
      <div className="flex items-start justify-between gap-3">
        <h3 id={headingId} className="min-w-0 truncate text-sm font-semibold">
          {feature}
        </h3>
        {action ? (
          <Button variant="outline" size="sm" className="shrink-0" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </div>

      {/* stats-11's first row: the used figure left, the charged amount right. */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          Used{' '}
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {typeof used === 'number' ? withUnit(used) : NOTHING}
          </span>
        </p>
        {/*
          The slot is named even when it is empty. stats-11 leaves its "$4.00"
          unlabelled because a demo knows what its own number is; a bare dash
          on a real card just reads as a glitch, and "Overage —" reads as the
          answer it is.
        */}
        <p className="text-muted-foreground shrink-0 text-xs">
          Overage{' '}
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {overage ?? <span className="text-muted-foreground font-normal">{NOTHING}</span>}
          </span>
        </p>
      </div>

      {/*
        No denominator, no bar. An unlimited entitlement drawn as a full bar
        reads as "exhausted" and as an empty one reads as "unused"; both are
        claims the data does not make.
      */}
      {percent === undefined ? null : (
        <Progress
          value={barValue}
          aria-label={meterName}
          style={{ '--quota-tone': toneColor(tone) } as CSSProperties}
          className="block gap-0 [&_[data-slot=progress-indicator]]:bg-[var(--quota-tone)] [&_[data-slot=progress-track]]:h-2"
        />
      )}

      {/* stats-11's second row: what is left, against what is included. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {unlimited ? (
          <Badge variant="info-light" size="sm" className="border-0">
            Unlimited
          </Badge>
        ) : over ? (
          <Badge variant="destructive-light" size="sm" className="border-0">
            Over by {withUnit(overBy as number)}
          </Badge>
        ) : remaining !== undefined ? (
          <Badge variant="success-light" size="sm" className="border-0">
            {withUnit(remaining)} left
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">{NOTHING} remaining</span>
        )}

        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {included === undefined
            ? `${NOTHING} included`
            : unlimited
              ? 'no included limit'
              : `of ${format(included)}${
                  resetPeriodLabel ? ` ${resetPeriodLabel.toLowerCase()}` : ''
                } quota`}
        </span>
      </div>

      {/*
        stats-11's footer, which is a dashed box rather than a ruled-off row.
        This was a `Separator` and a plain line until the block was actually
        vendored and could be read — the comment above it claimed a "divided
        footer" the block does not have. Worth the correction: the dashed
        outline is what marks the renewal date as a standing fact about the
        quota rather than one more reading taken this period.
      */}
      <div className="border-input text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-dashed p-2">
        <span className="text-xs">Quota renews on</span>
        <span className="text-foreground text-sm font-medium tabular-nums">
          {resetsOn
            ? new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(resetsOn)
            : NOTHING}
        </span>
      </div>

      {/*
        The reason a dash is a dash, stated rather than left to be guessed.
        `role="status"` so it is announced, following `Unavailable` on the Home
        dashboard and `SettingsUnavailable`.
      */}
      {overage || overageNote === undefined ? null : (
        <p role="status" className="text-muted-foreground text-xs">
          {overageNote}
        </p>
      )}
    </section>
  )
}
