import { BillingPeriod } from './price'

/**
 * The flat-fee price calculator, as V1 has it on the charge form: a contract
 * amount over a contract term, turned into the price for one billing period.
 *
 * V1 converts through months (a week is a quarter of a month, a day a
 * thirtieth) and rounds to cents. The same ratios are kept here, as exact
 * fractions with half-up rounding, so the figure never carries a float's
 * error into a price.
 */

/** Months in each period, as a fraction [numerator, denominator]. */
const MONTHS: Record<BillingPeriod, readonly [bigint, bigint]> = {
  [BillingPeriod.Daily]: [1n, 30n],
  [BillingPeriod.Weekly]: [1n, 4n],
  [BillingPeriod.Monthly]: [1n, 1n],
  [BillingPeriod.Quarterly]: [3n, 1n],
  [BillingPeriod.HalfYearly]: [6n, 1n],
  [BillingPeriod.Annual]: [12n, 1n],
  // V1 has no ratio for one-time and falls back to a year.
  [BillingPeriod.OneTime]: [12n, 1n],
}

/** The terms a contract amount can be written over, in V1's order. */
export const CONTRACT_TERMS = [
  BillingPeriod.Daily,
  BillingPeriod.Weekly,
  BillingPeriod.Monthly,
  BillingPeriod.Quarterly,
  BillingPeriod.HalfYearly,
  BillingPeriod.Annual,
] as const

const DECIMAL = /^(\d+)(?:\.(\d+))?$/
/** Commas only as thousands separators: "1,200.50", never "1,00". */
const GROUPED = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/

/**
 * The price per billing period for `amount` over `term`, to two decimals
 * (`"1200"` over a year, billed monthly, is `"100.00"`). Null when the amount
 * is not a plain non-negative number.
 */
export function contractAmountPerPeriod(
  amount: string,
  term: BillingPeriod,
  period: BillingPeriod,
): string | null {
  const text = amount.trim()
  if (text.includes(',') && !GROUPED.test(text)) return null
  const match = DECIMAL.exec(text.replace(/,/g, ''))
  if (!match) return null
  const decimals = match[2] ?? ''
  const value = BigInt(`${match[1]}${decimals}`)
  const [periodNum, periodDen] = MONTHS[period]
  const [termNum, termDen] = MONTHS[term]
  // amount × (period months ÷ term months), in cents.
  const numerator = value * periodNum * termDen * 100n
  const denominator = 10n ** BigInt(decimals.length) * periodDen * termNum
  const quotient = numerator / denominator
  const cents = (numerator % denominator) * 2n >= denominator ? quotient + 1n : quotient
  const digits = cents.toString().padStart(3, '0')
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`
}
