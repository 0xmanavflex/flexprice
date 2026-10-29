import { CREDIT_GRANT_PERIOD_LABEL, CreditGrantCadence, type CreditGrant } from './creditGrant'
import { meteredAllowanceLabel, type Entitlement } from './entitlement'
import { FeatureType } from './feature'
import { formatMoney, money } from './money'
import type { Plan } from './plan'
import {
  BILLING_PERIOD_LABEL,
  BillingPeriod,
  PriceType,
  type BillingPeriod as BillingPeriodValue,
  type Charge,
} from './price'

/**
 * The pricing widget: the published plans as a pricing page shows them, for
 * one billing period and one currency at a time, as V1 does it
 * (flexprice-front `src/pricing/adapters.ts`).
 *
 * A plan appears under a period and currency when it has a live charge in
 * both. Its headline is the recurring fixed fee; a plan that only meters
 * usage says so instead of showing a price it does not have.
 */

export interface PricingOption {
  label: string
  value: string
}

export interface PricingSelection {
  period: string
  currency: string
}

export interface PricingCardLine {
  id: string
  label: string
}

export interface PricingCard {
  planId: string
  name: string
  description: string
  /** "$29", or null when the plan bills usage only. */
  price: string | null
  /** "month", "year": what the price is per. */
  per: string
  /** Whether usage charges bill on top of the price. */
  hasUsage: boolean
  included: PricingCardLine[]
  credits: PricingCardLine[]
}

const PERIOD_ORDER: readonly BillingPeriodValue[] = [
  BillingPeriod.Monthly,
  BillingPeriod.Annual,
  BillingPeriod.Quarterly,
  BillingPeriod.HalfYearly,
  BillingPeriod.Weekly,
  BillingPeriod.Daily,
]

const PER: Record<BillingPeriodValue, string> = {
  [BillingPeriod.Daily]: 'day',
  [BillingPeriod.Weekly]: 'week',
  [BillingPeriod.Monthly]: 'month',
  [BillingPeriod.Quarterly]: 'quarter',
  [BillingPeriod.HalfYearly]: 'half-year',
  [BillingPeriod.Annual]: 'year',
  [BillingPeriod.OneTime]: 'one-time',
}

/** Charges that still bill: an ended price is history, not an offer. */
function live(charges: readonly Charge[], now: number): Charge[] {
  return charges.filter((charge) => !charge.endDate || charge.endDate.getTime() > now)
}

const isRecurringFixed = (charge: Charge) =>
  charge.type === PriceType.Fixed && charge.billingPeriod !== BillingPeriod.OneTime

const inSelection = (charge: Charge, selection: PricingSelection) =>
  charge.currency.toUpperCase() === selection.currency && charge.billingPeriod === selection.period

/** The billing periods and currencies the published plans are priced in. */
export function pricingOptions(
  chargesByPlan: ReadonlyMap<string, readonly Charge[]>,
  now: number = Date.now(),
): { periods: PricingOption[]; currencies: PricingOption[] } {
  const periods = new Set<string>()
  const currencies = new Set<string>()
  for (const charges of chargesByPlan.values()) {
    for (const charge of live(charges, now)) {
      if (charge.billingPeriod === BillingPeriod.OneTime) continue
      periods.add(charge.billingPeriod)
      currencies.add(charge.currency.toUpperCase())
    }
  }
  return {
    periods: PERIOD_ORDER.filter((period) => periods.has(period)).map((period) => ({
      label: BILLING_PERIOD_LABEL[period],
      value: period,
    })),
    currencies: [...currencies].sort().map((code) => ({ label: code, value: code })),
  }
}

/**
 * The period and currency that show the most plans, preferring plans with a
 * recurring fee: the view a pricing page would open on.
 */
export function defaultPricingSelection(
  chargesByPlan: ReadonlyMap<string, readonly Charge[]>,
  now: number = Date.now(),
): PricingSelection | null {
  const { periods, currencies } = pricingOptions(chargesByPlan, now)
  let best: { selection: PricingSelection; score: number } | null = null
  for (const period of periods) {
    for (const currency of currencies) {
      const selection = { period: period.value, currency: currency.value }
      let score = 0
      for (const charges of chargesByPlan.values()) {
        const matching = live(charges, now).filter((charge) => inSelection(charge, selection))
        if (matching.length === 0) continue
        // A recurring fee counts for more than usage alone, as in V1.
        score += matching.some(isRecurringFixed) ? 1000 : 1
      }
      if (score > 0 && (!best || score > best.score)) best = { selection, score }
    }
  }
  return best?.selection ?? null
}

function includedLine(entitlement: Entitlement): string {
  const name = entitlement.featureName ?? 'Feature'
  switch (entitlement.featureType) {
    case FeatureType.Metered:
      return `${meteredAllowanceLabel(entitlement)} ${name}`
    case FeatureType.Static:
      return entitlement.staticValue ? `${entitlement.staticValue} ${name}` : name
    default:
      return name
  }
}

function creditLine(grant: CreditGrant): string {
  const credits = Number(grant.credits)
  const amount = Number.isFinite(credits)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(credits)
    : grant.credits
  const cadence =
    grant.cadence === CreditGrantCadence.Recurring && grant.period
      ? CREDIT_GRANT_PERIOD_LABEL[grant.period].toLowerCase()
      : 'one-time'
  return `${amount} credits · ${grant.name} · ${cadence}`
}

/**
 * One card per plan priced in the selection: cheapest recurring fee first, a
 * plan that also meters usage after a flat one at the same fee, and plans
 * that only meter usage last.
 */
export function pricingCards(input: {
  plans: readonly Plan[]
  chargesByPlan: ReadonlyMap<string, readonly Charge[]>
  entitlements: readonly Entitlement[]
  creditGrantsByPlan: ReadonlyMap<string, readonly CreditGrant[]>
  selection: PricingSelection
  now?: number
}): PricingCard[] {
  const now = input.now ?? Date.now()
  const per = PER[input.selection.period as BillingPeriodValue] ?? input.selection.period
  const cards: (PricingCard & { sortAmount: number })[] = []
  for (const plan of input.plans) {
    const charges = live(input.chargesByPlan.get(plan.id) ?? [], now).filter((charge) =>
      inSelection(charge, input.selection),
    )
    if (charges.length === 0) continue
    const fixed = charges.filter(isRecurringFixed)
    const total = fixed.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
    const hasUsage = charges.some((charge) => charge.type === PriceType.Usage)
    cards.push({
      planId: plan.id,
      name: plan.name,
      description: plan.description,
      price:
        fixed.length > 0
          ? formatMoney(money(String(Number(total.toFixed(6))), input.selection.currency))
          : null,
      per,
      hasUsage,
      included: input.entitlements
        .filter((entitlement) => entitlement.entityId === plan.id)
        .filter(
          (entitlement) =>
            entitlement.featureType !== FeatureType.Boolean || entitlement.isEnabled !== false,
        )
        .map((entitlement) => ({ id: entitlement.id, label: includedLine(entitlement) })),
      credits: (input.creditGrantsByPlan.get(plan.id) ?? []).map((grant) => ({
        id: grant.id,
        label: creditLine(grant),
      })),
      sortAmount: fixed.length > 0 ? total : Number.POSITIVE_INFINITY,
    })
  }
  return cards
    .sort((a, b) => a.sortAmount - b.sortAmount || Number(a.hasUsage) - Number(b.hasUsage))
    .map(({ sortAmount: _sortAmount, ...card }) => card)
}
