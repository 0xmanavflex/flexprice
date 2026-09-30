import { useMemo } from 'react'
import {
  BILLING_PERIOD_SHORT,
  BillingModel,
  type BillingPeriod,
  type CreateCharge,
  PriceType,
} from '@fp/domain'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ui/components/primitives/card'
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
  /** Sample usage per metered charge, for the example bill. */
  sampleQuantity?: number
  locale?: string
}

/** A charge's label, falling back to the meter name, then the billing model. */
function chargeLabel(charge: CreateCharge, meterLabel: (id: string) => string): string {
  if (charge.displayName) return charge.displayName
  if (charge.type === PriceType.Usage && charge.meterId) return meterLabel(charge.meterId)
  return charge.type === PriceType.Fixed ? 'Base fee' : 'Usage charge'
}

function money(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** A short human line describing how a charge prices, e.g. "$2 per 1,000". */
function pricingSummary(charge: CreateCharge, currency: string, locale?: string): string {
  switch (charge.billingModel) {
    case BillingModel.FlatFee: {
      const amount = Number(charge.amount || 0)
      return charge.type === PriceType.Fixed
        ? money(amount, currency, locale)
        : `${money(amount, currency, locale)} / unit`
    }
    case BillingModel.Package: {
      const amount = Number(charge.amount || 0)
      return `${money(amount, currency, locale)} per ${charge.divideBy.toLocaleString()}`
    }
    case BillingModel.Tiered: {
      const first = charge.tiers[0]
      const from = first ? Number(first.unitAmount || 0) : 0
      return `Tiered, from ${money(from, currency, locale)} / unit`
    }
  }
}

/** What one charge costs at a sample quantity, tiers and packages resolved. */
function estimate(charge: CreateCharge, quantity: number): number {
  if (charge.billingModel === BillingModel.FlatFee) {
    const amount = Number(charge.amount || 0)
    return charge.type === PriceType.Fixed ? amount : amount * quantity
  }
  if (charge.billingModel === BillingModel.Package) {
    const amount = Number(charge.amount || 0)
    const size = charge.divideBy || 1
    return Math.ceil(quantity / size) * amount
  }
  // Tiered: volume charges the whole quantity at the band it lands in; slab
  // charges each band's slice at its own rate. Both add any per-band flat fee.
  const bands = charge.tiers
  if (charge.tierMode === 'VOLUME') {
    let lower = 0
    for (const band of bands) {
      const upper = band.upTo ?? Infinity
      if (quantity <= upper || upper === Infinity) {
        return quantity * Number(band.unitAmount || 0) + Number(band.flatAmount || 0)
      }
      lower = upper
    }
    void lower
    return 0
  }
  let total = 0
  let lower = 0
  for (const band of bands) {
    const upper = band.upTo ?? Infinity
    if (quantity <= lower) break
    const unitsInBand = Math.min(quantity, upper) - lower
    if (unitsInBand > 0) {
      total += unitsInBand * Number(band.unitAmount || 0) + Number(band.flatAmount || 0)
    }
    lower = upper
  }
  return total
}

export function PlanPreviewCard({
  name,
  charges,
  meterLabel = (id) => id,
  sampleQuantity = 10_000,
  locale,
}: PlanPreviewCardProps) {
  const currency = (charges.find((c) => c.currency)?.currency ?? 'USD').toUpperCase()

  const headline = useMemo(() => {
    const base =
      charges.find(
        (c) => c.type === PriceType.Fixed && c.billingModel === BillingModel.FlatFee,
      ) ?? charges[0]
    if (!base) return null
    if (base.billingModel === BillingModel.FlatFee && base.type === PriceType.Fixed) {
      return {
        amount: money(Number(base.amount || 0), currency, locale),
        period: BILLING_PERIOD_SHORT[base.billingPeriod as BillingPeriod] ?? '',
      }
    }
    return { amount: 'Usage-based', period: '' }
  }, [charges, currency, locale])

  const fixedTotal = charges
    .filter((c) => c.type === PriceType.Fixed)
    .reduce((sum, c) => sum + estimate(c, 0), 0)
  const usageCharges = charges.filter((c) => c.type === PriceType.Usage)
  const usageTotal = usageCharges.reduce((sum, c) => sum + estimate(c, sampleQuantity), 0)
  const exampleTotal = fixedTotal + usageTotal

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate">{name || 'Untitled plan'}</CardTitle>
        </div>
        <CardDescription>Live preview — updates as you edit</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* The headline: one price, over its period. */}
        <div className="flex items-baseline gap-1">
          {headline ? (
            <>
              <span className="text-2xl font-semibold tracking-tight">{headline.amount}</span>
              {headline.period ? (
                <span className="text-sm text-muted-foreground">/{headline.period}</span>
              ) : null}
            </>
          ) : (
            <span className="text-2xl font-semibold tracking-tight text-muted-foreground">—</span>
          )}
        </div>

        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No charges yet. Add a fixed or usage charge to see the plan take shape.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {charges.map((charge, index) => (
                <div key={index} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{chargeLabel(charge, meterLabel)}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {pricingSummary(charge, currency, locale)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            {/* The example bill: what a month costs at a sample level of usage. */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Recurring</span>
                <span className="tabular-nums">{money(fixedTotal, currency, locale)}</span>
              </div>
              {usageCharges.length > 0 ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">
                    Usage at {sampleQuantity.toLocaleString()} units
                  </span>
                  <span className="tabular-nums">{money(usageTotal, currency, locale)}</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-baseline justify-between border-t pt-2 font-medium">
                <span>Example bill</span>
                <span className="tabular-nums">{money(exampleTotal, currency, locale)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
