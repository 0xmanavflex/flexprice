import { useEffect, useRef, type ReactNode } from 'react'
import { useShellDetailTrail } from './shell/ShellDetailTrail'
import { ChevronRightIcon } from 'lucide-react'
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

/** One step in a detail page's breadcrumb. The last is the current page. */
export interface DetailCrumb {
  label: string
  /** Navigates there. The last crumb (the current page) never has one. */
  onClick?: () => void
}

/**
 * The detail page's own breadcrumb — where this record sits, and the way back.
 *
 * A real trail ("Customers / Acme Robotics"), not a lone back button: it names
 * the parent list *and* the record, so the header says which one you are on
 * without re-reading the title, and the parent is one click away. Rendered above
 * the title, it replaces the assorted "← Back" links each detail page used to
 * grow its own.
 */
export function DetailBreadcrumb({ trail }: { trail: DetailCrumb[] }) {
  const publish = useShellDetailTrail()
  const latest = useRef(trail)
  latest.current = trail
  const key = trail.map((crumb) => crumb.label).join('\u0000')

  // Inside the console shell the header already shows the trail, so the page
  // hands its trail up and renders nothing; bare (stories, tests) it renders.
  useEffect(() => {
    if (!publish) return
    publish(
      latest.current.map((crumb, index) => ({
        label: crumb.label,
        onClick: () => latest.current[index]?.onClick?.(),
        hasClick: Boolean(crumb.onClick),
      })),
    )
    return () => publish(null)
  }, [publish, key])

  if (publish) return null
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {crumb.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={cn(isLast && 'font-medium text-foreground')}
                  {...(isLast ? { 'aria-current': 'page' as const } : {})}
                >
                  {crumb.label}
                </span>
              )}
              {isLast ? null : <ChevronRightIcon aria-hidden className="size-3.5 shrink-0" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export interface DetailShellProps {
  /** The breadcrumb trail. Preferred over `breadcrumb` — every detail page's is the same shape. */
  trail?: DetailCrumb[]
  /** A freeform breadcrumb node, for anything the `trail` shape does not fit. */
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
  trail,
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
      <header className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-5 px-6 pt-5 pb-5">
        {trail && trail.length > 0 ? <DetailBreadcrumb trail={trail} /> : breadcrumb}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            {/*
             * Title and badges on one row, anchored: `leading-tight` pulls the
             * title's line box in so the small chips centre on the letters rather
             * than floating in the slack above and below a full-height line — the
             * "hanging pill" look. The badges are their own group so they keep an
             * even gap among themselves and wrap together under a long title.
             */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 truncate text-2xl font-semibold leading-tight tracking-tight">
                {title}
              </h1>
              {badges ? (
                <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
              ) : null}
            </div>
            {identifier ? (
              <span className="font-mono text-xs text-muted-foreground">{identifier}</span>
            ) : null}
            {description ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">{actions}</div>
          ) : null}
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
