import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { SummaryRow } from './DetailKit'

/**
 * A detail page's summary row: a few key facts, side by side.
 *
 * The reference's inline-figures treatment (`SummaryRow`): numbers between two
 * rules, no cards. Compact by design: a label over one value, because this
 * answers "what is this" at a glance, not "how is it trending".
 */
export const DetailStatsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail-kit'],
  note: 'Reference SummaryRow for a detail page header.',
})

export interface DetailStat {
  label: string
  value: ReactNode
}

export interface DetailStatsProps {
  stats: DetailStat[]
  className?: string
}

export function DetailStats({ stats, className }: DetailStatsProps) {
  return <SummaryRow items={stats} {...(className ? { className } : {})} />
}
