import type { ReactNode } from 'react'
import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A titled, bordered surface on a detail or settings page.
 *
 * Resolution (UI_REVAMP rule 4 vs the Card-like look): pages never use the
 * `Card` primitive for sections; they compose `Section` / DetailKit parts, and
 * the reference app's Section markup wins: `bg-background rounded-xl border`,
 * a `border-b px-6 py-4` header, and a body that is `p-6` unless `flush`
 * (tables and lists that run edge to edge). Side-by-side sections stretch to
 * equal height because the body is `flex-1`.
 *
 * The title is a real heading and `aria-labelledby` points the region at it.
 */
export const SectionProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Reference Section: bordered panel with header rule, action slot, padded or flush body. Not the Card primitive.',
})

export interface SectionProps {
  title: string
  description?: string
  /** Buttons scoped to this section, in the header. */
  actions?: ReactNode
  /** Reference name for `actions`; either works. */
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean
  /** Heading level, so a page's outline stays correct. */
  as?: 'h1' | 'h2' | 'h3'
}

export function Section({
  title,
  description,
  actions,
  action,
  children,
  className,
  bodyClassName,
  flush,
  as: Heading = 'h2',
}: SectionProps) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const headerAction = actions ?? action

  return (
    <section
      aria-labelledby={id}
      className={cn('bg-background flex flex-col rounded-xl border', className)}
    >
      <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
        <div className="space-y-0.5">
          <Heading id={id} className="text-sm font-medium">
            {title}
          </Heading>
          {description ? <p className="sr-only">{description}</p> : null}
        </div>
        {headerAction ? (
          <div className="flex shrink-0 items-center gap-2">{headerAction}</div>
        ) : null}
      </div>
      <div className={cn('flex-1', !flush && 'p-6', bodyClassName)}>{children}</div>
    </section>
  )
}

export const PanelProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'Reference Panel: soft outer tray, title row with optional hint, white inner surface.',
})

export interface PanelProps {
  title?: string
  /** Tooltip text behind an info icon beside the title. */
  hint?: string
  description?: string
  action?: ReactNode
  /** Sits beside the title (anything richer than `hint`). */
  titleAdornment?: ReactNode
  /** Id for the heading, so a wrapper can `aria-labelledby` it. */
  titleId?: string
  /** Heading level, so the page outline stays correct (default `h2`: a page's `h1` then its panels). */
  as?: 'h2' | 'h3'
  className?: string
  /** Extra classes for the inner white surface (the reference leaves it unpadded). */
  innerClassName?: string
  children: ReactNode
}

/** Console panel: soft outer tray, title row, white inner surface. */
export function Panel({
  title,
  hint,
  description,
  action,
  titleAdornment,
  titleId,
  as: Heading = 'h2',
  className,
  innerClassName,
  children,
}: PanelProps) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn('bg-muted/40 flex flex-col rounded-xl border p-1', className)}
    >
      {title || action ? (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-4">
          <div className="space-y-0.5">
            {title ? (
              <Heading id={titleId} className="flex items-center gap-1.5 text-sm font-medium">
                {title}
                {hint ? (
                  <Tooltip>
                    <TooltipTrigger render={<span className="text-muted-foreground inline-flex" />}>
                      <InfoIcon className="size-3.5" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{hint}</TooltipContent>
                  </Tooltip>
                ) : null}
                {titleAdornment}
              </Heading>
            ) : null}
            {description ? <p className="sr-only">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn('bg-background flex flex-1 flex-col rounded-lg border', innerClassName)}>
        {children}
      </div>
    </section>
  )
}
