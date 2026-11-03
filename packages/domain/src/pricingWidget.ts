import { decimalSum } from './customerPortal'
import { CREDIT_GRANT_PERIOD_LABEL, CreditGrantCadence, type CreditGrant } from './creditGrant'
import { meteredAllowanceLabel, type Entitlement } from './entitlement'
import { FeatureType } from './feature'
import type { Plan } from './plan'
import {
  BILLING_PERIOD_LABEL,
  BillingModel,
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
  /** The whole line, as one string: "10,000 AI message". */
  label: string
}

/** An "Included" line: the feature's type and name pick its icon, as V1's card does. */
export interface PricingIncludedLine extends PricingCardLine {
  featureType: FeatureType
  featureName: string
}

/** A "Credits" line, in V1's three parts: "100 credits" · "Free credits" · "one-time". */
export interface PricingCreditLine extends PricingCardLine {
  amount: string
  /** Null when the grant's name only repeats its cadence ("Monthly included credits"). */
  name: string | null
  /** "one-time", or the period it recurs on: "monthly". */
  cadence: string
  recurring: boolean
}

export interface PricingCard {
  planId: string
  name: string
  description: string
  /**
   * The recurring fixed fee, as V1 prints it: "$29", "$0". A plan that only
   * meters usage reads "$0", as in V1, with usage on top. A tiered fee costs
   * what its quantity makes it, so a price with one reads "from $49".
   */
  price: string
  /** "month", "year": what the price is per. Null for one-time fees alone. */
  per: string | null
  /** Whether usage charges bill on top of the price. */
  hasUsage: boolean
  included: PricingIncludedLine[]
  credits: PricingCreditLine[]
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

/** A grant name that only says when it recurs, which the cadence already says. */
function isBoilerplateGrantName(raw: string): boolean {
  const name = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return !name || /^(monthly|annual|quarterly|weekly|daily) included credits?$/.test(name)
}

function creditLine(grant: CreditGrant): PricingCreditLine {
  const credits = Number(grant.credits)
  const formatted = Number.isFinite(credits)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(credits)
    : grant.credits
  const recurring = grant.cadence === CreditGrantCadence.Recurring
  const cadence =
    recurring && grant.period
      ? CREDIT_GRANT_PERIOD_LABEL[grant.period].toLowerCase()
      : recurring
        ? 'recurring'
        : 'one-time'
  const amount = `${formatted} credits`
  const name = isBoilerplateGrantName(grant.name) ? null : grant.name
  return {
    id: grant.id,
    amount,
    name,
    cadence,
    recurring,
    label: [amount, name, cadence].filter(Boolean).join(' · '),
  }
}

/**
 * An amount as V1's pricing card prints it: the currency's symbol and the
 * number as it is, no forced cents ("$0", "$49", "$12.5").
 *
 * A stored decimal string keeps every place it has, so a token rate such as
 * "0.00000015" never prints as "$0"; a computed number keeps up to six.
 */
export function pricingAmount(amount: number | string, currency: string): string {
  const places =
    typeof amount === 'string' ? (amount.split('.')[1] ?? '').replace(/0+$/, '').length : 0
  try {
    // A decimal string is formatted as written (Intl.NumberFormat v3), not as a float.
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(20, Math.max(6, places)),
    }).format(
      typeof amount === 'string' && /^-?\d+(\.\d+)?$/.test(amount)
        ? (amount as `${number}`)
        : Number(amount) || 0,
    )
  } catch {
    return `${currency} ${amount}`
  }
}

/** What a plan includes, as its card lists it: a switched-off feature is not included. */
function includedLines(entitlements: readonly Entitlement[]): PricingIncludedLine[] {
  return entitlements
    .filter(
      (entitlement) =>
        entitlement.featureType !== FeatureType.Boolean || entitlement.isEnabled !== false,
    )
    .map((entitlement) => ({
      id: entitlement.id,
      label: includedLine(entitlement),
      featureType: entitlement.featureType,
      featureName: entitlement.featureName ?? 'Feature',
    }))
}

/**
 * One card per plan priced in the selection: cheapest recurring fee first, a
 * plan that also meters usage after a flat one at the same fee, and plans
 * that only meter usage last.
 */
export function pricingCards(input: {
  plans: readonly Pick<Plan, 'id' | 'name' | 'description'>[]
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
    // Each fee by its own model: a flat fee at its amount, a tiered one at its
    // floor (its amount is empty), so a tiered fee is never read as $0.
    const total = decimalSum(fixed.map(feeFloor))
    const hasUsage = charges.some((charge) => charge.type === PriceType.Usage)
    cards.push({
      planId: plan.id,
      name: plan.name,
      description: plan.description,
      price: `${fixed.some(isTiered) ? 'from ' : ''}${pricingAmount(total, input.selection.currency)}`,
      per,
      hasUsage,
      included: includedLines(input.entitlements.filter((e) => e.entityId === plan.id)),
      credits: (input.creditGrantsByPlan.get(plan.id) ?? []).map(creditLine),
      sortAmount: fixed.length > 0 ? Number(total) : Number.POSITIVE_INFINITY,
    })
  }
  return cards
    .sort((a, b) => a.sortAmount - b.sortAmount || Number(a.hasUsage) - Number(b.hasUsage))
    .map(({ sortAmount: _sortAmount, ...card }) => card)
}

/** A usage charge in V1's compact wording: "$0.01/unit", "$5/pkg", "from $0.002/unit". */
export function usageChargeCompact(charge: Charge): string {
  const currency = charge.currency.toUpperCase()
  if (charge.billingModel === BillingModel.Tiered && charge.tiers.length > 0) {
    return `from ${pricingAmount(charge.tiers[0]!.unitAmount || '0', currency)}/unit`
  }
  const amount = pricingAmount(charge.amount || '0', currency)
  return charge.billingModel === BillingModel.Package ? `${amount}/pkg` : `${amount}/unit`
}

/**
 * A plan's own preview. Usage charges are not listed: a plan can meter
 * thousands, and the card says only that usage bills on top (`hasUsage`).
 */
export interface PricingPreview extends PricingCard {
  /** One-time fees, in the previewed currency: never part of the recurring price. */
  oneTime: { id: string; name: string; price: string }[]
}

const isOneTimeFee = (charge: Charge) =>
  charge.type === PriceType.Fixed && charge.billingPeriod === BillingPeriod.OneTime

const isTiered = (charge: Charge) =>
  charge.billingModel === BillingModel.Tiered && charge.tiers.length > 0

/**
 * What a tiered fee costs at least: one unit of its first band, the band's
 * flat amount plus its unit amount. Its price depends on quantity past that.
 */
function tieredFloor(charge: Charge): string {
  const first = charge.tiers[0]!
  return decimalSum([first.flatAmount || '0', first.unitAmount || '0'])
}

/** What a fee costs at least: its amount, or a tiered fee's floor. */
function feeFloor(charge: Charge): string {
  return isTiered(charge) ? tieredFloor(charge) : charge.amount || '0'
}

/** A fee as its line shows it: a tiered one "from" its floor, never its empty amount. */
function feePrice(charge: Charge, currency: string): string {
  if (!isTiered(charge)) return pricingAmount(charge.amount || '0', currency)
  return `from ${pricingAmount(tieredFloor(charge), currency)}`
}

/**
 * One plan as its pricing card would show it, for the plan's own preview: the
 * period and currency the widget would open on, so the two agree. Null while
 * the plan has no live charge.
 */
export function pricingPreview(input: {
  plan: Pick<Plan, 'id' | 'name' | 'description'>
  charges: readonly Charge[]
  entitlements: readonly Entitlement[]
  creditGrants: readonly CreditGrant[]
  now?: number
}): PricingPreview | null {
  const now = input.now ?? Date.now()
  const chargesByPlan = new Map([[input.plan.id, input.charges]])
  const selection = defaultPricingSelection(chargesByPlan, now)
  const fees = live(input.charges, now).filter(isOneTimeFee)
  const oneTimeIn = (currency: string) =>
    fees
      .filter((charge) => charge.currency.toUpperCase() === currency)
      .map((charge) => ({
        id: charge.id,
        name: charge.displayName || 'One-time fee',
        price: feePrice(charge, currency),
      }))
  if (!selection) {
    // Only one-time fees: the card's price is what they come to, with no period.
    const currency = fees[0]?.currency.toUpperCase()
    if (!currency) return null
    const oneTime = oneTimeIn(currency)
    const inCurrency = fees.filter((charge) => charge.currency.toUpperCase() === currency)
    // Every fee counts: a tiered one at its floor, which makes the total a floor too.
    const total = decimalSum(inCurrency.map(feeFloor))
    const price = `${inCurrency.some(isTiered) ? 'from ' : ''}${pricingAmount(total, currency)}`
    return {
      planId: input.plan.id,
      name: input.plan.name,
      description: input.plan.description,
      price,
      per: null,
      hasUsage: false,
      included: includedLines(input.entitlements),
      credits: input.creditGrants.map(creditLine),
      oneTime,
    }
  }
  const [card] = pricingCards({
    plans: [input.plan],
    chargesByPlan,
    entitlements: input.entitlements.map((entitlement) => ({
      ...entitlement,
      entityId: input.plan.id,
    })),
    creditGrantsByPlan: new Map([[input.plan.id, input.creditGrants]]),
    selection,
    now,
  })
  if (!card) return null
  return { ...card, oneTime: oneTimeIn(selection.currency) }
}
