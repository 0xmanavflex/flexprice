import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { Panel } from './Section'

/**
 * Chart "boxing": the reference `Panel` (muted tray carrying the title and
 * description, white inner surface) with the plot padded inside. Used wherever
 * a chart or a composed visual is the content of a section.
 */
export const ChartBoxProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section'],
  note: 'Reference Panel with a padded inner surface for charts.',
})

export interface ChartBoxProps {
  title?: string
  description?: string
  /** Controls on the header's right edge (a range select, a toggle). */
  actions?: ReactNode
  /** Sits beside the title (an info tooltip trigger). */
  titleAdornment?: ReactNode
  /** Id for the heading, so a wrapper can `aria-labelledby` it. */
  titleId?: string
  children: ReactNode
  className?: string
  /** Extra classes for the inner surface, on top of its `gap-4 p-5`. */
  innerClassName?: string
}

export function ChartBox({
  title,
  description,
  actions,
  titleAdornment,
  titleId,
  children,
  className,
  innerClassName,
}: ChartBoxProps) {
  return (
    <Panel
      {...(title ? { title } : {})}
      {...(description ? { description } : {})}
      {...(actions ? { action: <div className="flex shrink-0 gap-2">{actions}</div> } : {})}
      {...(titleAdornment ? { titleAdornment } : {})}
      {...(titleId ? { titleId } : {})}
      {...(className ? { className } : {})}
      innerClassName={['gap-4 p-5', innerClassName].filter(Boolean).join(' ')}
    >
      {children}
    </Panel>
  )
}
