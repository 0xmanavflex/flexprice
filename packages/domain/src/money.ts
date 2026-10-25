/**
 * Money, without floats.
 *
 * The backend serializes monetary amounts as decimal *strings*: the SDK types
 * `amountDue`, `amountPaid`, `total` and the rest as `string | undefined`:
 * precisely so that precision survives the wire. The V1 dashboard then calls
 * `parseFloat` on them in 101 places, which converts an exact decimal into the
 * nearest IEEE-754 double. It also declares `decimal.js` as a dependency that
 * no file imports.
 *
 * The cost is not theoretical:
 *
 *   Intl.format('12345678901234567.89')  ->  $12,345,678,901,234,567.89
 *   Intl.format(Number(same string))     ->  $12,345,678,901,234,568.00
 *
 * A billing product cannot round a customer's invoice by a dollar because a
 * component wanted a number. So `Money` keeps the exact string the API sent,
 * carries its currency with it, and never silently becomes a float.
 *
 * Note what is deliberately absent: arithmetic. Totals, tax, proration and
 * discounts are the backend's answer, and a UI that recomputes them will
 * eventually disagree with the invoice the customer was actually charged. If
 * you need a sum the API did not send, that is an API gap: not a reason to add
 * `addMoney`.
 */
export interface Money {
  /** The exact decimal as the API sent it, e.g. `"1234.56"`. Never a number. */
  readonly amount: string
  /** ISO 4217, uppercase, e.g. `"USD"`. */
  readonly currency: string
}

const DECIMAL = /^-?\d+(\.\d+)?$/

export class InvalidMoneyError extends Error {
  constructor(value: string) {
    super(`Not a decimal amount: ${JSON.stringify(value)}`)
    this.name = 'InvalidMoneyError'
  }
}

/**
 * Builds a `Money` from what the API sent.
 *
 * Rejects anything that is not a plain decimal: including `"1e3"`, `"NaN"` and
 * `""`. An amount that reached the UI malformed is a bug worth surfacing at the
 * boundary rather than rendering as `$NaN` three components later.
 */
export function money(amount: string, currency: string): Money {
  if (!DECIMAL.test(amount)) throw new InvalidMoneyError(amount)
  const code = currency.trim().toUpperCase()
  // Intl.NumberFormat throws RangeError on "" and takes the route down with it.
  // A blank code is not a currency; reject it here, where the value is built.
  if (code === '') throw new InvalidMoneyError(currency)
  return { amount, currency: code }
}

/**
 * Builds a `Money` from an optional API field, defaulting to zero.
 *
 * Almost every monetary field in the SDK is optional. Without this, each call
 * site invents its own `?? '0'`, and they disagree.
 */
export function moneyOr(
  amount: string | null | undefined,
  currency: string | null | undefined,
  fallbackCurrency = 'USD',
): Money {
  // `??` leaves "" in place, and "" is not a currency. Treat it as absent.
  const code = currency?.trim()
  return money(amount ?? '0', code ? code : fallbackCurrency)
}

/**
 * Formats for display.
 *
 * `Intl.NumberFormat.format` accepts a string and formats the exact decimal, so
 * the value never round-trips through a double on its way to the screen.
 */
export function formatMoney(value: Money, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency: value.currency,
    // ES2023 (Intl.NumberFormat v3) accepts a string here and formats the exact
    // decimal: which is the entire point of this module, and is covered by a
    // test asserting the large-value case a double gets wrong.
    //
    // TypeScript's lib types still narrow the parameter to
    // `StringNumericLiteral`, a template-literal type that only matches
    // literals, so a runtime string cannot satisfy it. The cast is the one
    // place that gap is bridged; it is not a licence to pass a number.
  }).format(value.amount as unknown as number)
}

/** Splits a decimal string into sign and digits, without parsing it. */
function parts(amount: string): { negative: boolean; whole: string; fraction: string } {
  const negative = amount.startsWith('-')
  const unsigned = negative ? amount.slice(1) : amount
  const [whole = '0', fraction = ''] = unsigned.split('.')
  // "-0.00" is zero, and zero is not negative.
  const isZero = /^0*$/.test(whole) && /^0*$/.test(fraction)
  return { negative: negative && !isZero, whole, fraction }
}

function compareDigits(a: string, b: string): number {
  const width = Math.max(a.length, b.length)
  const left = a.padStart(width, '0')
  const right = b.padStart(width, '0')
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Orders two amounts. Negative, zero or positive, like any comparator.
 *
 * Compares digit by digit rather than converting, so `"0.1"` plus `"0.2"`
 * cannot become `0.30000000000000004`, and a 20-digit amount still sorts
 * correctly. Throws on mismatched currencies: comparing USD to EUR is a
 * question with no answer, and returning one would hide the bug.
 */
export function compareMoney(a: Money, b: Money): number {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot compare ${a.currency} with ${b.currency}`)
  }

  const left = parts(a.amount)
  const right = parts(b.amount)

  if (left.negative !== right.negative) return left.negative ? -1 : 1

  const magnitude =
    compareDigits(left.whole, right.whole) ||
    compareDigits(
      left.fraction.padEnd(right.fraction.length, '0'),
      right.fraction.padEnd(left.fraction.length, '0'),
    )

  return left.negative ? -magnitude : magnitude
}

export function isZeroMoney(value: Money): boolean {
  const { whole, fraction } = parts(value.amount)
  return /^0*$/.test(whole) && /^0*$/.test(fraction)
}

export function isNegativeMoney(value: Money): boolean {
  return parts(value.amount).negative
}

const PLAIN_DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/

/**
 * An amount shared out over a quantity: a line's unit price, shown beside
 * its quantity: computed exactly on scaled integers, never in floating
 * point. Rounded half away from zero to `places` decimals. `null` when the
 * quantity is not a positive number, since nothing is divided then.
 */
export function perUnit(value: Money, quantity: string, places = 6): Money | null {
  const amount = PLAIN_DECIMAL.exec(value.amount)
  const qty = PLAIN_DECIMAL.exec(quantity.replace(/,/g, '').trim())
  if (!amount || !qty || qty[1]) return null
  const amountDecimals = amount[3] ?? ''
  const qtyDecimals = qty[3] ?? ''
  const numerator = BigInt(`${amount[2]}${amountDecimals}`)
  const denominator = BigInt(`${qty[2]}${qtyDecimals}`)
  if (denominator === 0n) return null
  // result * 10^places = amount / qty * 10^places
  //   = numerator * 10^(places + qtyDecimals - amountDecimals) / denominator
  const shift = places + qtyDecimals.length - amountDecimals.length
  const scaledNumerator = shift >= 0 ? numerator * 10n ** BigInt(shift) : numerator
  const scaledDenominator = shift >= 0 ? denominator : denominator * 10n ** BigInt(-shift)
  const quotient = scaledNumerator / scaledDenominator
  const rounded =
    (scaledNumerator % scaledDenominator) * 2n >= scaledDenominator ? quotient + 1n : quotient
  const digits = rounded.toString().padStart(places + 1, '0')
  const whole = digits.slice(0, digits.length - places)
  const fraction = digits.slice(digits.length - places).replace(/0+$/, '')
  const sign = amount[1] && rounded !== 0n ? '-' : ''
  return { amount: `${sign}${whole}${fraction ? `.${fraction}` : ''}`, currency: value.currency }
}

/**
 * A currency code as its symbol, or the code itself when there is none. The
 * full symbol, not the narrow one, so dollars stay apart: "$" is US dollars,
 * "CA$" and "A$" the Canadian and Australian ones.
 */
export function currencySymbol(currency: string): string {
  const code = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return code
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    )
  } catch {
    return code
  }
}
