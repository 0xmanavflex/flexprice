import { Metric } from './Metric'
import { provenance } from '@ui/provenance'

/**
 * A row of summary counts above a list.
 *
 * The billing dashboards this borrows from open a list with its shape: how many
 * there are, and the split that matters: before the rows themselves. Each stat
 * is a `Metric` card, so the number treatment (tabular figures, the loading
 * shimmer) is the one already used everywhere else.
 *
 * Presentational: it takes numbers and renders. A value of `undefined` is a real
 * state: "not counted yet": and shows a dash rather than a confident zero.
 */
export const StatCardsProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/Metric'],
  note: 'A responsive row of Metric cards for the count strip above a list.',
})

export interface Stat {
  label: string
  value: number | undefined
  hint?: string
}

export interface StatCardsProps {
  stats: Stat[]
  isLoading?: boolean
  locale?: string
}

export function StatCards({ stats, isLoading = false, locale }: StatCardsProps) {
  const format = (value: number) => new Intl.NumberFormat(locale).format(value)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <Metric
          key={stat.label}
          label={stat.label}
          value={stat.value === undefined ? '—' : format(stat.value)}
          isLoading={isLoading}
          {...(stat.hint ? { hint: stat.hint } : {})}
        />
      ))}
    </div>
  )
}
