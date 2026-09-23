import { type Money as MoneyValue, formatMoney, isNegativeMoney, isZeroMoney } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * An amount of money, rendered honestly.
 *
 * Takes a domain `Money` — never a number and never a string — so it is
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
  /** Colours negatives — for credits and refunds, where the sign is the meaning. */
  signed?: boolean
  className?: string
}

export function Money({ value, locale, muteZero = false, signed = false, className }: MoneyProps) {
  const zero = isZeroMoney(value)
  const negative = isNegativeMoney(value)

  return (
    <span
      className={cn(
        'tabular-nums',
        muteZero && zero && 'text-muted-foreground',
        signed && negative && 'text-destructive',
        className,
      )}
    >
      {formatMoney(value, locale)}
    </span>
  )
}
