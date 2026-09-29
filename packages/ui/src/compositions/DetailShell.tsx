import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { MetricRail, type DetailMetric } from './MetricRail'

/**
 * The one shell every detail page opens with.
 *
 * Before this, detail pages used two different headers with two different
 * breadcrumb styles, and only some got a summary strip — so the flagship plan
 * page looked unlike the rest. This is the single opening: a breadcrumb, a large
 * title with its status badges and identifier, an actions cluster, and — the
 * part that makes a detail page worth visiting — a **metric rail** of how the
 * record is doing. The body (tabs or sections) is `children`.
 */
export const DetailShellProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Shared detail-page shell: breadcrumb, large title, badges, identifier, actions, metric rail, body.',
})

export interface DetailShellProps {
  breadcrumb?: ReactNode
  title: string
  /** Status and type chips, in a row beside the title. */
  badges?: ReactNode
  /** The lookup key or id, shown monospaced under the title. */
  identifier?: ReactNode
  description?: ReactNode
  /** The primary action and any overflow menu, kept to the right of the title. */
  actions?: ReactNode
  /** The metric rail. Omitted (not an empty strip) when there is nothing to show. */
  metrics?: DetailMetric[]
  children: ReactNode
  className?: string
}

export function DetailShell({
  breadcrumb,
  title,
  badges,
  identifier,
  description,
  actions,
  metrics,
  children,
  className,
}: DetailShellProps) {
  return (
    // `overflow-y-auto` so the whole detail page scrolls within the shell's
    // content region (which is `overflow-hidden`): header + body together, so a
    // long page is never clipped.
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}>
      <header className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-4 px-6 pt-5 pb-5">
        {breadcrumb}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              {badges}
            </div>
            {identifier ? (
              <span className="font-mono text-xs text-muted-foreground">{identifier}</span>
            ) : null}
            {description ? (
              <div className="max-w-3xl text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {metrics && metrics.length > 0 ? <MetricRail metrics={metrics} /> : null}
      </header>
      {/* Header and body each cap at `--shell-max` and centre, so they align
          with each other and with the shell header, and the detail page fills a
          1440 screen but stops sprawling edge-to-edge at 2560. */}
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] min-h-0 flex-1 flex-col gap-6 px-6 pb-10">
        {children}
      </div>
    </div>
  )
}
