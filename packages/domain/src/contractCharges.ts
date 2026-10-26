import { BillingPeriod, type Charge } from './price'

/**
 * Which of a plan's charges a new contract will actually bill: the backend's
 * rule (`filterValidPricesForSubscription` and `IsCadenceAllowed` in the
 * subscription service), so the form never shows a charge as billable when
 * the API will drop it.
 *
 * - **Attached by default:** charges in the contract's currency that are
 *   one-time, or whose billing period equals the contract's. The period count
 *   is not compared, matching the API.
 * - **Opt-in:** charges in the contract's currency at another cadence that
 *   still fits: equal to, dividing, or a whole multiple of the contract's
 *   (monthly on a quarterly contract, annual on a monthly one). They attach
 *   only when listed in `include_price_ids`.
 * - **Not billed:** another currency, or a cadence that does not fit
 *   (weekly on a monthly contract, two-monthly on a quarterly one).
 *
 * Opting in makes `include_price_ids` authoritative: the API then attaches
 * exactly the listed ids, and refuses the request if any of them does not fit.
 * So a default charge whose cadence does not fit (same period, a count that
 * does not divide) cannot ride along with an opt-in, and is reported as such.
 */
export interface ContractChargeSelection {
  /** Billed on the contract. */
  attached: Charge[]
  /** At another cadence that fits; billed only if opted in. */
  optional: Charge[]
  /** Never billed on this contract, with the reason. */
  excluded: { charge: Charge; reason: 'currency' | 'cadence' }[]
  /** `include_price_ids` for the request; null when nothing is opted in (the API's default). */
  includePriceIds: string[] | null
}

const MONTHS: Partial<Record<BillingPeriod, number>> = {
  [BillingPeriod.Monthly]: 1,
  [BillingPeriod.Quarterly]: 3,
  [BillingPeriod.HalfYearly]: 6,
  [BillingPeriod.Annual]: 12,
}

/** The API's `IsCadenceCompatible`: does the item's cadence divide the contract's? */
function divides(
  subPeriod: BillingPeriod,
  subCount: number,
  itemPeriod: BillingPeriod,
  itemCount: number,
): boolean {
  const sc = subCount > 0 ? subCount : 1
  const ic = itemCount > 0 ? itemCount : 1
  if (subPeriod === BillingPeriod.OneTime || itemPeriod === BillingPeriod.OneTime) return false
  if (subPeriod === itemPeriod && sc === ic) return true
  const subMonths = (MONTHS[subPeriod] ?? 0) * sc
  const itemMonths = (MONTHS[itemPeriod] ?? 0) * ic
  if (subMonths === 0 || itemMonths === 0) return false
  return subMonths % itemMonths === 0
}

/** The API's `IsCadenceAllowed`: equal, dividing, or a whole multiple. */
export function cadenceAllowed(
  subPeriod: BillingPeriod,
  subCount: number,
  itemPeriod: BillingPeriod,
  itemCount: number,
): boolean {
  return (
    divides(subPeriod, subCount, itemPeriod, itemCount) ||
    divides(itemPeriod, itemCount, subPeriod, subCount)
  )
}

export function selectContractCharges(
  charges: readonly Charge[],
  contract: {
    currency: string
    billingPeriod: BillingPeriod
    billingPeriodCount: number
    /** Charges at another cadence the person opted into. */
    optedInIds: readonly string[]
  },
): ContractChargeSelection {
  const currency = contract.currency.trim().toUpperCase()
  const opted = new Set(contract.optedInIds)
  const attached: Charge[] = []
  const optional: Charge[] = []
  const excluded: ContractChargeSelection['excluded'] = []
  const fits = (charge: Charge) =>
    cadenceAllowed(
      contract.billingPeriod,
      contract.billingPeriodCount,
      charge.billingPeriod,
      charge.billingPeriodCount,
    )

  // Opt-ins only count while they are still offered.
  const candidates = charges.filter(
    (charge) =>
      charge.currency.trim().toUpperCase() === currency &&
      charge.billingPeriod !== BillingPeriod.OneTime &&
      charge.billingPeriod !== contract.billingPeriod &&
      fits(charge),
  )
  const anyOptedIn = candidates.some((charge) => opted.has(charge.id))

  for (const charge of charges) {
    if (charge.currency.trim().toUpperCase() !== currency) {
      excluded.push({ charge, reason: 'currency' })
      continue
    }
    if (charge.billingPeriod === BillingPeriod.OneTime) {
      attached.push(charge)
      continue
    }
    if (charge.billingPeriod === contract.billingPeriod) {
      // Attached by default; with an include list it must also fit.
      if (!anyOptedIn || fits(charge)) attached.push(charge)
      else excluded.push({ charge, reason: 'cadence' })
      continue
    }
    if (fits(charge)) {
      if (opted.has(charge.id)) attached.push(charge)
      else optional.push(charge)
      continue
    }
    excluded.push({ charge, reason: 'cadence' })
  }

  return {
    attached,
    optional,
    excluded,
    includePriceIds: anyOptedIn ? attached.map((charge) => charge.id) : null,
  }
}

/**
 * The add-on prices the API attaches to a contract: its currency, and its
 * billing period or one-time (`ValidateAndFilterPricesForSubscription`, strict
 * period match for add-ons). Commitments are only offered on these.
 */
export function attachableAddonCharges(
  charges: readonly Charge[],
  contract: { currency: string; billingPeriod: BillingPeriod | string },
): Charge[] {
  const currency = contract.currency.trim().toUpperCase()
  return charges.filter(
    (charge) =>
      charge.currency.trim().toUpperCase() === currency &&
      (charge.billingPeriod === contract.billingPeriod ||
        charge.billingPeriod === BillingPeriod.OneTime),
  )
}
