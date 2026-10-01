import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A titled region of a page.
 *
 * Card is the project's surface (see `provenance`, `SURFACE`), so this is a
 * Card with its heading association done properly: the title is a real heading
 * and `aria-labelledby` points the region at it, which a bare `<div>` with big
 * text does not do.
 *
 * `actions` sits in the header rather than floating, because a button whose
 * scope is "this section" should be inside the section it acts on.
 */
export const SectionProvenance = provenance({
  source: 'composition',
  composes: ['ui/card'],
  note: 'Card with heading association and a header action slot.',
})

export interface SectionProps {
  title: string
  description?: string
  /** Buttons scoped to this section. */
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Heading level, so a page's outline stays correct. */
  as?: 'h2' | 'h3'
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  as: Heading = 'h2',
}: SectionProps) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section
      aria-labelledby={id}
      className={cn('bg-card flex flex-col gap-4 rounded-xl border p-5', className)}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Heading id={id} className="text-sm font-medium">
            {title}
          </Heading>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
