import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  BILLING_PERIOD_SHORT,
  BillingModel,
  type BillingPeriod,
  type CreateCharge,
  CreditGrantCadence,
  CreditGrantPeriod,
  FeatureType,
  PriceType,
} from '@fp/domain'
import { Card, CardContent } from '@ui/components/primitives/card'
import { Separator } from '@ui/components/primitives/separator'
import { provenance } from '@ui/provenance'

/**
 * The live pricing preview beside the charges editor.
 *
 * The signature V2 improvement: a customer's-eye view of the plan that updates
 * as charges are drafted. It reuses the pricing-card idiom from `PlanGrid`'s
 * cards view — a name, one headline price, then what the plan carries — and adds
 * the thing a pricing card cannot show on its own: **an example bill**, so the
 * person pricing the plan sees what a month actually costs at a sample level of
 * usage, tiers and packages resolved, before anyone is billed for real.
 *
 * It is driven entirely from the draft `CreateCharge[]`; it fetches nothing and
 * decides nothing, so it renders identically in a story and in the editor.
 */
export const PlanPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/card', 'ui/separator'],
  note: 'Reuses PlanGrid’s pricing-card idiom; adds a live example-bill estimate.',
})

export interface PlanPreviewCardProps {
  name: string
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

const MAX_INCLUDED = 3
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** One "Included" line for an entitlement, staged or saved — both share these fields. */
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </h3>
  )
}

export function PlanPreviewCard({
  name,
  charges,
  meterLabel = (id) => id,
  meterUnit,
  trialDays,
  included = [],
  credits = [],
  locale,
}: PlanPreviewCardProps) {
  const currency = (charges.find((c) => c.currency)?.currency ?? 'USD').toUpperCase()
  const usageCharges = charges.filter((c) => c.type === PriceType.Usage)
  const fixed = charges.filter((c) => c.type !== PriceType.Usage)
  const base = fixed.find((c) => c.billingModel === BillingModel.FlatFee) ?? fixed[0]
  const period = base ? BILLING_PERIOD_SHORT[base.billingPeriod as BillingPeriod] : undefined
  const shown = included.slice(0, MAX_INCLUDED)
  const extra = included.length - shown.length

  const trial = trialDays && trialDays > 0 ? `${trialDays}-day free trial` : null
  const tail = [trial, usageCharges.length > 0 ? 'plus usage' : null].filter(Boolean).join(' · ')

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">What customers see</span>
          <span className="truncate text-sm font-medium">{name || 'Untitled plan'}</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            {base ? (
              <>
                <span className="text-3xl font-medium tracking-tight tabular-nums">
                  {base.billingModel === BillingModel.FlatFee
                    ? money(Number(base.amount || 0), currency, locale)
                    : pricingSummary(base, currency, locale)}
                </span>
                {period ? <span className="text-muted-foreground text-sm">/ {period}</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground text-3xl font-medium tracking-tight">
                {usageCharges.length > 0 ? 'Usage-based' : '—'}
              </span>
            )}
          </div>
          {tail ? <span className="text-muted-foreground text-xs">{tail}</span> : null}
        </div>

        {charges.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No charges yet. Add a fixed or usage charge to see the plan take shape.
          </p>
        ) : null}

        {usageCharges.length > 0 ? (
          <>
            <Separator />
            <section className="flex flex-col gap-2.5" aria-label="Usage">
              <SectionLabel>Usage</SectionLabel>
              {usageCharges.map((charge, index) => (
                <div key={index} className="flex flex-col text-sm">
                  <span className="font-medium">{chargeLabel(charge, meterLabel)}</span>
                  <span className="text-muted-foreground">
                    {pricingSummary(
                      charge,
                      currency,
                      locale,
                      charge.meterId ? meterUnit?.(charge.meterId) : undefined,
                    )}
                  </span>
                </div>
              ))}
            </section>
          </>
        ) : null}

        {included.length > 0 ? (
          <>
            <Separator />
            <section className="flex flex-col gap-2" aria-label="Included">
              <SectionLabel>Included</SectionLabel>
              {shown.map((line) => (
                <div key={line.key} className="flex items-center gap-2 text-sm">
                  <CheckIcon aria-hidden className="size-3.5 shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate">{line.label}</span>
                  {line.value ? (
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {line.value}
                    </span>
                  ) : null}
                </div>
              ))}
              {extra > 0 ? (
                <span className="text-muted-foreground text-xs">and {extra} more</span>
              ) : null}
            </section>
          </>
        ) : null}

        {credits.length > 0 ? (
          <>
            <Separator />
            <section className="flex flex-col gap-2" aria-label="Credits">
              <SectionLabel>Credits</SectionLabel>
              {credits.map((line) => (
                <div key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{line.label}</span>
                  {line.value ? (
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {line.value}
                    </span>
                  ) : null}
                </div>
              ))}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
