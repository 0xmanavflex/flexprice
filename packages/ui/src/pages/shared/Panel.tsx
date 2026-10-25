import type { ReactNode } from 'react'
import { InfoIcon } from '@ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A console panel: a soft outer tray, a title row, and a white inner surface.
 *
 * The tray is what makes a dashboard read as one grid of related things instead
 * of a heap of boxes: the title and its one-line description sit on the tray,
 * the content sits on the page-coloured surface inside it. Charts, meters and
 * usage lists all land in the inner surface, so give them their own padding.
 */
export const PanelProvenance = provenance({
  source: 'custom',
  reason:
    'The console panel from the reference design: tray, title row with optional hint and action, inner surface. No ReUI equivalent, and the `Card` primitive is not used.',
})

export interface PanelProps {
  title: string
  /** An explanation shown in a tooltip beside the title. */
  hint?: string | undefined
  /** One quiet line under the title. */
  description?: string | undefined
  /** Top-right of the title row: a link or a button. */
  action?: ReactNode
  className?: string | undefined
  children: ReactNode
}

export function Panel({ title, hint, description, action, className, children }: PanelProps) {
  return (
    <section className={cn('bg-muted/40 flex flex-col rounded-xl border p-1', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-4">
        <div className="space-y-0.5">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            {title}
            {hint ? (
              <Tooltip>
                <TooltipTrigger render={<span className="text-muted-foreground inline-flex" />}>
                  <InfoIcon className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">{hint}</span>
                </TooltipTrigger>
                <TooltipContent>{hint}</TooltipContent>
              </Tooltip>
            ) : null}
          </h3>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="bg-background flex flex-1 flex-col rounded-lg border">{children}</div>
    </section>
  )
}
