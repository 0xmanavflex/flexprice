import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The redesign's chart "boxing": a muted outer card carrying the title and
 * description, with the plot sitting in an inner white card. Used wherever a
 * chart or a composed visual is the content of a section.
 */
export const ChartBoxProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Nested muted-outer / white-inner card for charts.',
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
  /** Padding of the inner card. */
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
    <section aria-labelledby={titleId} className={cn('bg-muted/40 flex flex-col rounded-2xl border p-1', className)}>
      {title || actions ? (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <div className="flex items-center gap-1.5">
                <h3 id={titleId} className="text-sm font-medium">
                  {title}
                </h3>
                {titleAdornment}
              </div>
            ) : null}
            {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('bg-card flex flex-col gap-4 rounded-xl border p-5', innerClassName)}>{children}</div>
    </section>
  )
}
