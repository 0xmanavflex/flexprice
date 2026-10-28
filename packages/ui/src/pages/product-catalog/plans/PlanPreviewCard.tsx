import { CheckIcon } from '@ui/icons'
import type { ReactNode } from 'react'
import {
  BILLING_PERIOD_SHORT,
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  CreditGrantCadence,
  CreditGrantPeriod,
  FeatureType,
  PriceType,
  usageBasedLabel,
} from '@fp/domain'
import { FormPreview, PreviewSection } from '@ui/compositions/forms/FormPreview'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The live pricing preview beside the charges editor.
 *
 * The signature V2 improvement: a customer's-eye view of the plan that updates
 * as charges are drafted. It reuses the pricing-card idiom from `PlanGrid`'s
 * cards view: a name, one headline price, then what the plan carries: and adds
 * the thing a pricing card cannot show on its own: **an example bill**, so the
 * person pricing the plan sees what a month actually costs at a sample level of
 * usage, tiers and packages resolved, before anyone is billed for real.
 *
 * It is driven entirely from the draft `CreateCharge[]`; it fetches nothing and
 * decides nothing, so it renders identically in a story and in the editor.
 */
export const PlanPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-preview'],
  note: 'Reuses PlanGrid’s pricing-card idiom; adds a live example-bill estimate.',
})

export interface PlanPreviewCardProps {
  charges: CreateCharge[]
  /** Resolves a usage charge's meter id to a readable feature name. */
  meterLabel?: (meterId: string) => string
  /** Resolves a meter id to its singular unit ("call"), for "per call" wording. */
  meterUnit?: (meterId: string) => string | undefined
  /** Free-trial length in days, when the plan has one. */
  trialDays?: number | null | undefined
  /** What the plan includes, one line per entitlement (see `includedLine`). */
  included?: PreviewLine[]
  /** Credits the plan hands out, one line per grant. */
  credits?: PreviewLine[]
  locale?: string
  /** Passed to the rail: `sticky top-6` on a detail page, nothing on a form. */
  className?: string
  /** `card` boxes it, for a saved plan; `rail` is the form's column. */
  variant?: 'rail' | 'card'
  /**
   * Element ids the section titles jump to, when the preview sits beside the
   * tables it summarises. Omitted on a form, where there is nothing to jump
   * to: the tables do not exist yet.
   */
  onJump?: ((target: string) => void) | undefined
  jumpTargets?: { charges?: string; included?: string; credits?: string }
}

export interface PreviewLine {
  key: string
  label: ReactNode
  value?: ReactNode
}

const CREDIT_PERIOD_SHORT: Record<CreditGrantPeriod, string> = {
  [CreditGrantPeriod.Daily]: 'day',
  [CreditGrantPeriod.Weekly]: 'wk',
  [CreditGrantPeriod.Monthly]: 'mo',
  [CreditGrantPeriod.Quarterly]: 'qtr',
  [CreditGrantPeriod.HalfYearly]: '6 mo',
  [CreditGrantPeriod.Annual]: 'yr',
}

/** One "Credits" line for a grant: "5,000 once" or "2,000 / mo". */
export function creditLine(g: {
  key: string
  name: string
  credits: string | number
  cadence: CreditGrantCadence
  period?: CreditGrantPeriod | null | undefined
}): PreviewLine {
  const amount = Number(g.credits || 0).toLocaleString()
  const when =
    g.cadence === CreditGrantCadence.Recurring && g.period
      ? `/ ${CREDIT_PERIOD_SHORT[g.period]}`
      : 'once'
  return { key: g.key, label: g.name || 'Credit grant', value: `${amount} ${when}` }
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** One "Included" line for an entitlement, staged or saved: both share these fields. */
export function includedLine(e: {
  key: string
  name: string
  /** Plural unit of a metered feature ("tokens"), shown after the allowance. */
  unit?: string | undefined
  featureType: FeatureType
  usageLimit?: number | null | undefined
  staticValue?: string | null | undefined
  isEnabled?: boolean | null | undefined
}): PreviewLine {
  switch (e.featureType) {
    case FeatureType.Metered:
      return {
        key: e.key,
        label: e.name,
        value:
          e.usageLimit == null
            ? 'Unlimited'
            : [compact.format(e.usageLimit), e.unit].filter(Boolean).join(' '),
      }
    case FeatureType.Static:
      return { key: e.key, label: e.name, value: e.staticValue || undefined }
    default:
      return { key: e.key, label: e.name, value: e.isEnabled === false ? 'Off' : undefined }
  }
}

/** A charge's label, falling back to the meter name, then the billing model. */
export function chargeLabel(charge: CreateCharge, meterLabel: (id: string) => string): string {
  if (charge.displayName) return charge.displayName
  if (charge.type === PriceType.Usage && charge.meterId) return meterLabel(charge.meterId)
  return charge.type === PriceType.Fixed ? 'Base fee' : 'Usage charge'
}

export function money(amount: number, currency: string, locale?: string): string {
  try {
    // Sub-cent unit prices ($0.002 per call) must not round to $0.00.
    const wholeCents = Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency,
      ...(wholeCents ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** A short human line describing how a charge prices, e.g. "$2 per 1,000". */
export function pricingSummary(
  charge: CreateCharge,
  currency: string,
  locale?: string,
  unit?: string,
): string {
  const per = `per ${unit || 'unit'}`
  switch (charge.billingModel) {
    case BillingModel.FlatFee: {
      const amount = Number(charge.amount || 0)
      return charge.type === PriceType.Fixed
        ? money(amount, currency, locale)
        : `${money(amount, currency, locale)} ${per}`
    }
    case BillingModel.Package: {
      const amount = Number(charge.amount || 0)
      return `${money(amount, currency, locale)} per ${charge.divideBy.toLocaleString()}`
    }
    case BillingModel.Tiered: {
      const first = charge.tiers[0]
      const from = first ? Number(first.unitAmount || 0) : 0
      const n = charge.tiers.length
      return `${n} tier${n === 1 ? '' : 's'}, from ${money(from, currency, locale)} ${per}`
    }
  }
}

function More({ n }: { n: number }) {
  return n > 0 ? <li className="text-muted-foreground text-xs">and {n} more</li> : null
}

const CAP = 3
const PERIOD_WORD: Record<string, string> = { mo: 'month', yr: 'year' }

export function PlanPreviewCard({
  charges,
  meterLabel = (id) => id,
  meterUnit,
  trialDays,
  included = [],
  credits = [],
  locale,
  className,
  variant = 'rail',
  jumpTargets,
  onJump,
}: PlanPreviewCardProps) {
  const currency = (charges.find((c) => c.currency)?.currency ?? 'USD').toUpperCase()
  const usageCharges = charges.filter((c) => c.type === PriceType.Usage)
  const fixed = charges.filter((c) => c.type !== PriceType.Usage)
  const base = fixed.find((c) => c.billingModel === BillingModel.FlatFee) ?? fixed[0]
  const extras = fixed.filter((c) => c !== base)
  const short = base ? BILLING_PERIOD_SHORT[base.billingPeriod as BillingPeriod] : undefined
  const period = short ? (PERIOD_WORD[short] ?? short) : undefined

  const trial = trialDays && trialDays > 0 ? `${trialDays}-day free trial` : null
  // With no fixed fee there is no flat price for usage to be "plus": the
  // headline is the usage itself, named as a customer reads it.
  const usageOnly = !base && usageCharges.length > 0
  const usageNames = usageCharges.map((charge) => chargeLabel(charge, meterLabel))
  const tail = [trial, usageCharges.length > 0 && !usageOnly ? 'plus usage' : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <FormPreview
      title="What customers see"
      label="Plan preview"
      variant={variant}
      {...(className ? { className } : {})}
    >
      {charges.length === 0 ? (
        <p className="text-muted-foreground text-[13px]/relaxed">
          Add a charge and the price customers see builds up here.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              {base ? (
                <>
                  <span className="text-3xl font-medium tabular-nums">
                    {base.billingModel === BillingModel.FlatFee
                      ? money(Number(base.amount || 0), currency, locale)
                      : pricingSummary(base, currency, locale)}
                  </span>
                  {period ? (
                    <span className="text-muted-foreground text-sm">/ {period}</span>
                  ) : null}
                </>
              ) : (
                <span
                  className={cn(
                    'font-medium',
                    usageOnly ? 'text-2xl' : 'text-muted-foreground text-3xl',
                  )}
                >
                  {usageOnly ? usageBasedLabel(usageNames) : '—'}
                </span>
              )}
            </div>
            {tail ? <p className="text-muted-foreground text-xs">{tail}</p> : null}
          </div>

          {extras.length > 0 ? (
            <PreviewSection
              onJump={onJump}
              title="Also billed"
              {...(jumpTargets?.charges ? { jumpTo: jumpTargets.charges } : {})}
            >
              <ul className="space-y-2 text-[13px]">
                {extras.slice(0, CAP).map((charge, index) => (
                  <li key={index} className="flex justify-between gap-3">
                    <span>{chargeLabel(charge, meterLabel)}</span>
                    <span className="text-muted-foreground text-right tabular-nums">
                      {charge.billingPeriod === BillingPeriod.OneTime
                        ? `${pricingSummary(charge, currency, locale)} once`
                        : pricingSummary(charge, currency, locale)}
                    </span>
                  </li>
                ))}
                <More n={extras.length - CAP} />
              </ul>
            </PreviewSection>
          ) : null}

          {usageCharges.length > 0 ? (
            <PreviewSection
              onJump={onJump}
              title="Usage"
              {...(jumpTargets?.charges ? { jumpTo: jumpTargets.charges } : {})}
            >
              <ul className="space-y-2.5 text-[13px]">
                {usageCharges.slice(0, CAP).map((charge, index) => (
                  <li key={index} className="space-y-0.5">
                    <span className="block">{chargeLabel(charge, meterLabel)}</span>
                    <span className="text-muted-foreground block tabular-nums">
                      {pricingSummary(
                        charge,
                        currency,
                        locale,
                        charge.meterId ? meterUnit?.(charge.meterId) : undefined,
                      )}
                    </span>
                  </li>
                ))}
                <More n={usageCharges.length - CAP} />
              </ul>
            </PreviewSection>
          ) : null}

          {included.length > 0 ? (
            <PreviewSection
              onJump={onJump}
              title="Included"
              {...(jumpTargets?.included ? { jumpTo: jumpTargets.included } : {})}
            >
              <ul className="space-y-2 text-[13px]">
                {included.slice(0, CAP).map((line) => (
                  <li key={line.key} className="flex items-start gap-2">
                    <CheckIcon aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
                    <span className="flex flex-1 justify-between gap-3">
                      <span>{line.label}</span>
                      {line.value ? (
                        <span className="text-muted-foreground text-right">{line.value}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
                <More n={included.length - CAP} />
              </ul>
            </PreviewSection>
          ) : null}

          {credits.length > 0 ? (
            <PreviewSection
              onJump={onJump}
              title="Credits"
              {...(jumpTargets?.credits ? { jumpTo: jumpTargets.credits } : {})}
            >
              <ul className="space-y-2 text-[13px]">
                {credits.slice(0, CAP).map((line) => (
                  <li key={line.key} className="flex justify-between gap-3">
                    <span>{line.label}</span>
                    {line.value ? (
                      <span className="text-muted-foreground tabular-nums">{line.value}</span>
                    ) : null}
                  </li>
                ))}
                <More n={credits.length - CAP} />
              </ul>
            </PreviewSection>
          ) : null}
        </>
      )}
    </FormPreview>
  )
}
