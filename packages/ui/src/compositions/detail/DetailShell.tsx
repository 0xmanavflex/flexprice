import { type ReactNode } from 'react'
import { usePublishDetailTrail, useShellDetailTrail } from '../shell/ShellDetailTrail'
import { ChevronRightIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { MetricRail, type DetailMetric } from './MetricRail'
import { DetailHeader } from './DetailHeader'

/**
 * The one shell every detail page opens with.
 *
 * Before this, detail pages used two different headers with two different
 * breadcrumb styles, and only some got a summary strip: so the flagship plan
 * page looked unlike the rest. This is the single opening: a breadcrumb, a large
 * title, status pills under the title, a right-hand cluster ("ID" copy chip,
 * More menu; see `DetailHeaderCluster`), and: the
 * part that makes a detail page worth visiting: a **metric rail** of how the
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
 * The detail page's own breadcrumb: where this record sits, and the way back.
 *
 * A real trail ("Customers / Customer details"), not a lone back button: it names
 * the parent list and the kind of page, never the record id. The title still
 * names the record. The parent is one click away. Rendered above
 * the title, it replaces the assorted "← Back" links each detail page used to
 * grow its own.
 */
export function DetailBreadcrumb({ trail }: { trail: DetailCrumb[] }) {
  const publish = useShellDetailTrail()
  // Inside the console shell the header already shows the trail, so the page
  // hands its trail up and renders nothing; bare (stories, tests) it renders.
  usePublishDetailTrail(trail)

  if (publish) return null
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {crumb.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={cn(isLast && 'text-foreground font-medium')}
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
  /** The breadcrumb trail. Preferred over `breadcrumb`: every detail page's is the same shape. */
  trail?: DetailCrumb[]
  /** A freeform breadcrumb node, for anything the `trail` shape does not fit. */
  breadcrumb?: ReactNode
  title: string
  /** Icon shown in the tile left of the title (reference DetailHeader). */
  icon?: ReactNode
  /** Status and type pills, shown small under the title (status first). */
  badges?: ReactNode
  /** The record id, rendered as an "ID" copy chip on the right. */
  id?: string
  /** Alias of `id`. */
  identifier?: string
  /** An email, rendered as a mail-icon copy chip beside the id. */
  email?: string
  /** Sits immediately before the copy-ID chip: connected integration marks. */
  leading?: ReactNode
  /** Legacy inline action slot. Prefer putting every action in `actions` via `DetailMoreMenu`. */
  primary?: ReactNode
  /** The overflow (More) menu, last in the right-hand cluster. Build it with `DetailMoreMenu`. */
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
 * viewport clips them: "Information" could not be reached by touch scroll at
 * all, and on the plan page that tab is the only place the plan ID and
 * description live. A whole field of data was simply inaccessible on a phone.
 *
 * Written as a descendant rule on the body rather than a prop, because the
 * page owns its `<Tabs>` and every detail page needs this: a prop is one each
 * page can forget. `data-slot` is the vendor's public targeting contract, so
 * this composes over the registry instead of forking it.
 *
 * The strip scrolls horizontally, snaps to whole tabs, and hides its
 * scrollbar (an 8px-tall bar inside a 32px pill reads as damage). Below `sm`,
 * where it always overflows, the edges fade so there is a visible signal that
 * the strip continues; above `sm` it usually fits, so no fade is drawn.
 */
const TAB_STRIP = [
  '[&_[data-slot=tabs-list]]:max-w-full',
  '[&_[data-slot=tabs-list]]:overflow-x-auto',
  '[&_[data-slot=tabs-list]]:snap-x',
  '[&_[data-slot=tabs-list]]:[scrollbar-width:none]',
  '[&_[data-slot=tabs-list]]:[&::-webkit-scrollbar]:hidden',
  '[&_[data-slot=tabs-list]>*]:snap-start',
  'max-sm:[&_[data-slot=tabs-list]]:[mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-10px),transparent)]',
].join(' ')

export function DetailShell({
  trail,
  breadcrumb,
  title,
  icon,
  badges,
  id,
  identifier,
  email,
  leading,
  primary,
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
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-5 px-6 pt-5 pb-5">
        {trail && trail.length > 0 ? <DetailBreadcrumb trail={trail} /> : breadcrumb}
        <DetailHeader
          title={title}
          icon={icon}
          badges={badges}
          id={id ?? identifier}
          email={email}
          leading={leading}
          primary={primary}
          actions={actions}
        />
        {metrics && metrics.length > 0 ? <MetricRail metrics={metrics} /> : null}
      </div>
      {/* Header and body each cap at `--shell-max` and centre, so they align
          with each other and with the shell header, and the detail page fills a
          1440 screen but stops sprawling edge-to-edge at 2560.

          No `min-h-0` here: the body must grow with its content. Allowed to
          shrink inside the scrolling shell, a tall tab (the invoice document)
          overflowed the body box and its `pb-10` was lost, so the page ended flush
          on the last block while short table tabs kept the gap.

          `TAB_STRIP` rides along here because the page owns its `<Tabs>`: the
          rule is a `data-slot` descendant selector rather than a prop, so no
          detail page can forget it and clip its last tab off a phone. */}
      <div
        className={cn(
          'mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-6 pb-10',
          TAB_STRIP,
        )}
      >
        {children}
      </div>
    </div>
  )
}
