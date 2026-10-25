import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { SummaryRow } from './DetailKit'

/**
 * A detail page's metric rail: the few numbers that say how the record is doing.
 *
 * This is the deliberate opposite of a metadata strip. Each tile leads with a
 * **big numeral**: money, a count, a rate: not the record's own attributes
 * (those live in the header and the Information section). A plan's rail carries
 * its subscribers and price, not its lookup key; a coupon's carries redemptions,
 * not its status. If a tile would just restate a badge or a field below, it does
 * not belong here.
 *
 * Rendered as the reference's `SummaryRow`: inline figures between two rules,
 * no cards. The value stays in high-contrast foreground (a KPI has to be
 * legible); direction, when it matters, rides a small arrow on the hint rather
 * than colouring the number.
 */
export const MetricRailProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail-kit'],
  note: 'KPI rail for detail pages: big-numeral metric tiles, not a metadata restatement.',
})

export interface DetailMetric {
  label: string
  /** The headline value: a number, money, or short phrase. Rendered large. */
  value: ReactNode
  /** A small qualifier under the value ("of 500", "this month", "vs last"). */
  hint?: string
  /** Adds a direction arrow to the hint for metrics where trend carries meaning. */
  sentiment?: 'positive' | 'negative' | 'muted'
}

export interface MetricRailProps {
  metrics: DetailMetric[]
  className?: string
}

const ARROW: Record<NonNullable<DetailMetric['sentiment']>, string> = {
  positive: '↑ ',
  negative: '↓ ',
  muted: '',
}

/**
 * The values that are the *absence* of a number, not a number.
 *
 * An em-dash is the placeholder a tile shows while it has nothing; a bare
 * zero is a count that has never happened. Neither is worth a tile on its own.
 */
const BLANK_VALUES = new Set(['', '—', '–', '-', '0'])

/** Whether a tile's headline value carries no information. */
function isBlank(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) return true
  if (typeof value === 'number') return value === 0
  if (typeof value === 'string') return BLANK_VALUES.has(value.trim())
  // A node we cannot read: a badge, a formatted amount: is assumed real.
  return false
}

export function MetricRail({ metrics, className }: MetricRailProps) {
  /*
   * Omit the rail rather than fake it.
   *
   * A rail of "0 /: /: / 0" is four tiles of nothing, and on a 390px phone
   * it ate ~310px of the first screen before any real content. The house rule
   * is that a tile is a number the record *has*, not a field it is missing:
   * so a rail where every tile is blank is not a rail, and the page opens on
   * its content instead. Enforced here rather than at each caller, so the rule
   * holds on every detail page without each one remembering it.
   */
  if (metrics.length === 0 || metrics.every((metric) => isBlank(metric.value))) return null

  return (
    <SummaryRow
      {...(className ? { className } : {})}
      items={metrics.map((metric) => ({
        label: metric.label,
        value: metric.value,
        ...(metric.hint
          ? { hint: `${metric.sentiment ? ARROW[metric.sentiment] : ''}${metric.hint}` }
          : {}),
      }))}
    />
  )
}
