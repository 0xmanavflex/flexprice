import type { ReactNode } from 'react'
import { Frame, FramePanel } from '@ui/components/reui/frame'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A detail page's summary rail: a few key facts, side by side.
 *
 * Built on the ReUI `Frame` — the same panelled surface the registry's stat
 * blocks use — so the cells read as one chrome strip rather than a row of loose
 * cards. Compact by design: a label over one value, not the big KPI numerals a
 * dashboard uses, because this answers "what is this" at a glance, not "how is
 * it trending".
 *
 * This is deliberately small and shared, so every detail page opens with the
 * same summary rather than a lonely empty state under the header.
 */
export const DetailStatsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/frame'],
  note: 'Frame-panelled summary strip for a detail page header.',
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
  return (
    <Frame
      dense
      className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4', className)}
    >
      {stats.map((stat) => (
        <FramePanel key={stat.label} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{stat.label}</span>
          <span className="truncate text-sm font-medium text-foreground">{stat.value}</span>
        </FramePanel>
      ))}
    </Frame>
  )
}
