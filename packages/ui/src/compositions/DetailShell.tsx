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

/**
 * Makes a detail page's tab strip reachable on a phone, and legible anywhere.
 *
 * The vendored `TabsList` is `inline-flex w-fit` with overflow left visible,
 * so at 390px the four-tab strip (Overview / Entitlements / Credit Grants /
 * Information) paints its later children outside the 373px strip, where the
 * viewport clips them — "Information" could not be reached by touch scroll at
 * all, and on the plan page that tab is the only place the plan ID and
 * description live. A whole field of data was simply inaccessible on a phone.
 *
 * Written as a descendant rule on the body rather than a prop, because the
 * page owns its `<Tabs>` and every detail page needs this — a prop is one each
 * page can forget. `data-slot` is the vendor's public targeting contract, so
 * this composes over the registry instead of forking it.
 *
 * The strip scrolls horizontally, snaps to whole tabs, and hides its
 * scrollbar (an 8px-tall bar inside a 32px pill reads as damage). Below `sm`,
 * where it always overflows, the edges fade so there is a visible signal that
 * the strip continues; above `sm` it usually fits, so no fade is drawn.
 *
 * The second rule is contrast. Stock paints an inactive tab `text-foreground/60`,
 * which over the muted pill is 4.14:1 — under the 4.5:1 floor, on the only
 * control that says what else is on the page. Raised to /70 (5.65:1) in light;
 * dark keeps the vendor's `muted-foreground`, and hover still resolves to full
 * foreground, so only the failing state moves.
 */
const TAB_STRIP = [
  '[&_[data-slot=tabs-list]]:max-w-full',
  '[&_[data-slot=tabs-list]]:overflow-x-auto',
  '[&_[data-slot=tabs-list]]:snap-x',
  '[&_[data-slot=tabs-list]]:[scrollbar-width:none]',
  '[&_[data-slot=tabs-list]]:[&::-webkit-scrollbar]:hidden',
  '[&_[data-slot=tabs-list]>*]:snap-start',
  'max-sm:[&_[data-slot=tabs-list]]:[mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-10px),transparent)]',
  '[&_[data-slot=tabs-trigger]:not([data-active])]:text-foreground/70',
  '[&_[data-slot=tabs-trigger]:not([data-active]):hover]:text-foreground',
  'dark:[&_[data-slot=tabs-trigger]:not([data-active])]:text-muted-foreground',
  'dark:[&_[data-slot=tabs-trigger]:not([data-active]):hover]:text-foreground',
].join(' ')

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
              <span className="text-muted-foreground font-mono text-xs">{identifier}</span>
            ) : null}
            {description ? (
              <div className="text-muted-foreground max-w-3xl text-sm">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {metrics && metrics.length > 0 ? <MetricRail metrics={metrics} /> : null}
      </header>
      {/* Header and body each cap at `--shell-max` and centre, so they align
          with each other and with the shell header, and the detail page fills a
          1440 screen but stops sprawling edge-to-edge at 2560.

          `TAB_STRIP` rides along here because the page owns its `<Tabs>`: the
          rule is a `data-slot` descendant selector rather than a prop, so no
          detail page can forget it and clip its last tab off a phone. */}
      <div
        className={cn(
          'mx-auto flex w-full max-w-[var(--shell-max)] min-h-0 flex-1 flex-col gap-6 px-6 pb-10',
          TAB_STRIP,
        )}
      >
        {children}
      </div>
    </div>
  )
}
