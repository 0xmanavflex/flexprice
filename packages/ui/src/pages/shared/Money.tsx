import { type Money as MoneyValue, formatMoney, isNegativeMoney, isZeroMoney } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * An amount of money, rendered honestly.
 *
 * Takes a domain `Money`: never a number and never a string: so it is
 * impossible to hand this component a value that has already been through a
 * float. That is the entire point: the API sends decimal strings, and V1 calls
 * `parseFloat` on them in 101 places.
 *
 * Tabular numerals are not decoration. In a column of amounts, proportional
 * digits make totals impossible to scan and misalign the decimal point.
 */
export const MoneyProvenance = provenance({
  source: 'custom',
  reason:
    'Currency display with exact-decimal formatting and sign semantics. ReUI has no money primitive, and the point is the type it refuses to accept.',
})

export interface MoneyProps {
  value: MoneyValue
  locale?: string
  /** Dims a zero amount, so a column of real charges stands out. */
  muteZero?: boolean
  /** Colours negatives: for credits and refunds, where the sign is the meaning. */
  signed?: boolean
  /**
   * Truncate rather than overflow, for table cells.
   *
   * An amount long enough to break a column is rare and real: a large
   * contract, or a currency with no minor unit. Left alone it pushes into the
   * next column and makes two cells unreadable instead of one. Truncated, the
   * row still scans and the full value is in the title attribute and available
   * to a screen reader.
   *
   * Not the default: a detail page has room, and silently hiding digits from
   * someone reading a single invoice is worse than a wide line.
   */
  truncate?: boolean
  className?: string
}

/**
 * `Intl.NumberFormat` throws a RangeError on a currency code it does not know.
 * A malformed code from the API must not take the page down, and must not be
 * silently shown as another currency: fall back to the plain number and the
 * code as sent.
 */
function safeFormat(value: MoneyValue, locale?: string): string {
  try {
    return formatMoney(value, locale)
  } catch {
    return `${value.amount} ${value.currency}`.trim()
  }
}

export function Money({
  value,
  locale,
  muteZero = false,
  signed = false,
  truncate = false,
  className,
}: MoneyProps) {
  const zero = isZeroMoney(value)
  const negative = isNegativeMoney(value)
  const formatted = safeFormat(value, locale)

  return (
    <span
      // The full amount stays reachable on hover and to assistive tech even
      // when the visible text is clipped.
      {...(truncate ? { title: formatted } : {})}
      className={cn(
        'tabular-nums',
        truncate && 'block max-w-full truncate',
        muteZero && zero && 'text-muted-foreground',
        signed && negative && 'text-destructive',
        className,
      )}
    >
      {formatted}
    </span>
  )
}
