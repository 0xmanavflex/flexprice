import { useId, type ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Progress } from '@ui/components/primitives/progress'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

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
 * - **The block's green "3000 free calls left" is coloured text.** It uses the
 *   `-foreground` token in light mode and the base token in dark, the pairing
 *   the light badge variants use, because bare `text-success` fails contrast.
 * - **The cost slot appears only with a cost.** Nothing in the API prices a
 *   per-feature overage, and `money.ts` forbids computing one here, so the slot
 *   is drawn only when `overage` is passed. An empty "Overage —" beside
 *   "Over by 281" read as a contradiction, and the over-quota quantity already
 *   has its own line.
 *
 * Fully controlled and presentational: every figure arrives as a prop, and any
 * prop left `undefined` renders the dash with its reason rather than a zero.
 */
export const QuotaCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/progress', 'ui/button'],
  note: "stats-11's quota-card arrangement over a real entitlement: used / included / percent / remaining / reset, with unlimited and over-quota states the block does not model and an unpriced overage slot that stays a dash. Lineage: @reui/stats-11.",
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
   * The percentage the API itself reported.
   *
   * Used only when the card cannot work it out: with both `used` and a
   * non-zero `included`, the figure comes from those, so the bar always
   * agrees with the numbers printed beside it. The API's `usage_percent` has
   * been seen to disagree (291 of 10 drawn as a third of a bar).
   */
  percentUsed?: number | undefined
  /** How often the allowance resets, as a word — "Monthly". Captions the denominator. */
  resetPeriodLabel?: string | undefined
  /** When the allowance next resets. `undefined`/`null` renders the dash. */
  resetsOn?: Date | null | undefined
  /**
   * What the overage has been charged at, already formatted (a `<Money>`).
   *
   * There is no endpoint for this today, so it is normally omitted and the
   * slot is not drawn. It is a prop so that the day an API prices an overage,
   * this card does not have to change shape.
   */
  overage?: ReactNode | undefined
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
    if (measurable) return ((used as number) / (included as number)) * 100
    if (percentUsed !== undefined) return Math.max(0, percentUsed)
    return undefined
  })()

  // Capped for the bar, uncapped for the reading — 120% must still say 120%.
  const barValue = percent === undefined ? 0 : Math.min(100, percent)
  const over = measurable && (used as number) > (included as number)

  const remaining = measurable ? Math.max(0, (included as number) - (used as number)) : undefined
  const overBy = over ? (used as number) - (included as number) : undefined

  // The bar signals state: the reference's amber past 85%, and the destructive
  // token once over. Never a colour from the call site.
  const barClass = over
    ? '**:data-[slot=progress-indicator]:bg-destructive'
    : percent !== undefined && percent > 85
      ? '**:data-[slot=progress-indicator]:bg-warning'
      : null

  // The whole reading, as one sentence fragment — the meter's accessible name.
  const meterName = `${label}: ${
    typeof used === 'number' ? withUnit(used) : 'an unreported amount'
  } of ${typeof included === 'number' ? format(included) : 'an unreported allowance'} used${
    percent === undefined ? '' : ` (${format(Math.round(percent))}%)`
  }`

  return (
    <section
      aria-labelledby={headingId}
      className={cn('bg-background flex min-w-0 flex-col gap-5 rounded-xl border p-5', className)}
    >
      {/* Header: the feature, and the way out to its detail. */}
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="min-w-0 truncate text-sm font-medium">
          {feature}
        </h3>
        {action ? (
          <Button variant="outline" size="sm" className="shrink-0" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {/* The used figure left, the charged amount right. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground min-w-0 truncate text-[13px]">
            Used{' '}
            <span className="text-foreground font-medium tabular-nums">
              {typeof used === 'number' ? withUnit(used) : NOTHING}
            </span>
          </p>
          {overage ? (
            <p className="text-muted-foreground shrink-0 text-[13px]">
              Overage{' '}
              <span className="text-foreground text-[15px] font-medium tabular-nums">
                {overage}
              </span>
            </p>
          ) : null}
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
            className={cn('block gap-0 **:data-[slot=progress-track]:h-2', barClass)}
          />
        )}

        {/* What is left, against what is included. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs">
          {unlimited ? (
            <span className="text-info-foreground dark:text-info font-medium">Unlimited</span>
          ) : over ? (
            <span className="text-destructive-foreground dark:text-destructive font-medium">
              Over by {withUnit(overBy as number)}
            </span>
          ) : remaining !== undefined ? (
            <span
              className={cn(
                'font-medium',
                percent !== undefined && percent > 85
                  ? 'text-warning-foreground dark:text-warning'
                  : 'text-success-foreground dark:text-success',
              )}
            >
              {withUnit(remaining)} left
            </span>
          ) : (
            <span className="text-muted-foreground">{NOTHING} remaining</span>
          )}

          <span className="text-muted-foreground shrink-0 tabular-nums">
            {included === undefined
              ? `${NOTHING} included`
              : unlimited
                ? 'no included limit'
                : `of ${format(included)}${
                    resetPeriodLabel ? ` ${resetPeriodLabel.toLowerCase()}` : ''
                  } quota`}
          </span>
        </div>
      </div>

      {/* The renewal date: a dashed box, a standing fact about the quota. */}
      <div className="text-muted-foreground flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-[13px]">
        <span>Quota renews on</span>
        <span className="text-foreground font-medium tabular-nums">
          {resetsOn && !Number.isNaN(resetsOn.getTime())
            ? new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(resetsOn)
            : NOTHING}
        </span>
      </div>
    </section>
  )
}
