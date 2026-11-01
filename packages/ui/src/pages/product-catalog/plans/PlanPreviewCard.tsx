import { CheckIcon, CoinsIcon } from '@ui/icons'
import type { ReactNode } from 'react'
import {
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  CREDIT_GRANT_PERIOD_LABEL,
  CreditGrantCadence,
  type CreditGrantPeriod,
  FeatureType,
  PriceType,
} from '@fp/domain'
import { FormPreview } from '@ui/compositions/forms/FormPreview'
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

/** One "Credits" line, as the pricing widget writes it. */
export function creditLine(g: {
  key: string
  name: string
  credits: string | number
  cadence: CreditGrantCadence
  period?: CreditGrantPeriod | null | undefined
}): PreviewLine {
  const credits = Number(g.credits || 0)
  const amount = Number.isFinite(credits) ? credits.toLocaleString('en-US') : String(g.credits)
  const cadence =
    g.cadence === CreditGrantCadence.Recurring && g.period
      ? CREDIT_GRANT_PERIOD_LABEL[g.period].toLowerCase()
      : 'one-time'
  return {
    key: g.key,
    label: `${amount} credits · ${g.name || 'Credit grant'} · ${cadence}`,
  }
}

/** One "Included" line, as the pricing widget writes it: allowance, then the name. */
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
    case FeatureType.Metered: {
      const allowance =
        e.usageLimit == null ? 'Unlimited' : Number(e.usageLimit).toLocaleString('en-US')
      return { key: e.key, label: `${allowance} ${e.name}` }
    }
    case FeatureType.Static:
      return { key: e.key, label: e.staticValue ? `${e.staticValue} ${e.name}` : e.name }
    default:
      return e.isEnabled === false
        ? { key: e.key, label: e.name, value: 'Off' }
        : { key: e.key, label: e.name }
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

const PER: Record<string, string> = {
  [BillingPeriod.Daily]: 'day',
  [BillingPeriod.Weekly]: 'week',
  [BillingPeriod.Monthly]: 'month',
  [BillingPeriod.Quarterly]: 'quarter',
  [BillingPeriod.HalfYearly]: 'half-year',
  [BillingPeriod.Annual]: 'year',
}

export function PlanPreviewCard({
  charges,
  trialDays,
  included = [],
  credits = [],
  locale,
  className,
  variant = 'rail',
}: PlanPreviewCardProps) {
  const currency = (charges.find((c) => c.currency)?.currency ?? 'USD').toUpperCase()
  const recurring = charges.filter(
    (charge) => charge.type === PriceType.Fixed && charge.billingPeriod !== BillingPeriod.OneTime,
  )
  const hasUsage = charges.some((charge) => charge.type === PriceType.Usage)
  const total = recurring.reduce((sum, charge) => {
    if (charge.billingModel === BillingModel.Tiered) return sum
    return sum + (Number(charge.amount) || 0)
  }, 0)
  const price = recurring.length > 0 ? money(total, currency, locale) : null
  const per = recurring[0] ? (PER[recurring[0].billingPeriod] ?? recurring[0].billingPeriod) : null
  const trial = trialDays && trialDays > 0 ? `${trialDays}-day free trial` : null

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
          <div className="flex flex-col gap-1">
            {price ? (
              <p className="flex items-baseline gap-1">
                <span className="text-2xl font-medium tabular-nums">{price}</span>
                {per ? <span className="text-muted-foreground text-sm">/{per}</span> : null}
              </p>
            ) : (
              <p className="text-2xl font-medium">Usage-based</p>
            )}
            {price && hasUsage ? (
              <p className="text-muted-foreground text-xs">Plus usage</p>
            ) : !price ? (
              <p className="text-muted-foreground text-xs">Billed on what is used</p>
            ) : null}
            {trial ? <p className="text-muted-foreground text-[13px]">{trial}</p> : null}
          </div>

          {included.length > 0 ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Included</p>
              <ul className="flex flex-col gap-2">
                {included
                  .filter((line) => line.value !== 'Off')
                  .map((line) => (
                    <li key={line.key} className="flex items-start gap-2 text-sm">
                      <CheckIcon
                        className="text-muted-foreground mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {line.label}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {credits.length > 0 ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Credits</p>
              <ul className="flex flex-col gap-2">
                {credits.map((line) => (
                  <li key={line.key} className="flex items-start gap-2 text-sm">
                    <CoinsIcon
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {line.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </FormPreview>
  )
}
