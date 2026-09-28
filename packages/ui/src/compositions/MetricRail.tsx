import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A detail page's metric rail: the few numbers that say how the record is doing.
 *
 * This is the deliberate opposite of a metadata strip. Each tile leads with a
 * **big numeral** — money, a count, a rate — not the record's own attributes
 * (those live in the header and the Information section). A plan's rail carries
 * its subscribers and price, not its lookup key; a coupon's carries redemptions,
 * not its status. If a tile would just restate a badge or a field below, it does
 * not belong here.
 *
 * Rendered as a hairline-separated grid so it reads as one instrument panel
 * rather than a row of loose cards. The value stays in high-contrast foreground
 * (a KPI has to be legible); direction, when it matters, rides a small arrow on
 * the hint rather than colouring the number a shade that fails contrast.
 */
export const MetricRailProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'KPI rail for detail pages — big-numeral metric tiles, not a metadata restatement.',
})

export interface DetailMetric {
  label: string
  /** The headline value — a number, money, or short phrase. Rendered large. */
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

const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
}

const ARROW: Record<NonNullable<DetailMetric['sentiment']>, string> = {
  positive: '↑ ',
  negative: '↓ ',
  muted: '',
}

export function MetricRail({ metrics, className }: MetricRailProps) {
  const cols = COLUMNS[Math.min(metrics.length, 5)] ?? COLUMNS[4]
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border bg-border shadow-xs',
        cols,
        className,
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col gap-1.5 bg-card p-4">
          <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
          {/* Value and hint both live in the <dd> so the group is dt+dd only —
              a hint as a sibling of dt/dd breaks axe's definition-list rule. */}
          <dd className="flex flex-col gap-1">
            <span className="text-2xl leading-none font-semibold tabular-nums text-foreground">
              {metric.value}
            </span>
            {metric.hint ? (
              <span className="text-xs text-muted-foreground">
                {metric.sentiment ? ARROW[metric.sentiment] : ''}
                {metric.hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
