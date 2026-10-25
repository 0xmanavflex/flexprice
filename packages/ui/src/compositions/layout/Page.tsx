import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The layout every screen uses.
 *
 * One skeleton, so no page invents its own. The current dashboard has a
 * different header treatment on most screens, which is what makes it feel like
 * several applications sharing a domain.
 *
 *   PageHeader    title, subtitle, primary action
 *   PageToolbar   search and filters            (list screens)
 *   PageBody      content
 */
export const PageProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Shared page skeleton: header, toolbar, body. Layout only.',
})

/** A page rendered inside another page's frame (a Settings list) drops its own gutters and scroll. */
export const EmbeddedPageContext = createContext(false)

export interface PageHeaderProps {
  title: string
  /** The one thing this page is for. A single button, not a row of them. */
  action?: ReactNode
  /** Reference name for `action`; both render in the same right-hand cluster. */
  actions?: ReactNode
  /** Everything else, behind an overflow menu. */
  menu?: ReactNode
  /** Small inline meta under the title (counts, status, last sync). */
  meta?: ReactNode
  breadcrumb?: ReactNode
}

export function PageHeader({ title, action, actions, menu, meta, breadcrumb }: PageHeaderProps) {
  /*
   * No rule under it. The shell's own header already draws one a few pixels
   * above, and two stacked hairlines read as a seam rather than a boundary.
   * The heading's size and the space below it are enough separation.
   */
  return (
    <header className="flex flex-col gap-3 px-6 pt-5 pb-4">
      {breadcrumb}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-medium tracking-tight">{title}</h1>
          {meta ? <div className="text-muted-foreground text-[13px]">{meta}</div> : null}
        </div>
        {action || actions || menu ? (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {actions}
            {menu}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="border-b px-6 py-3">{children}</div>
}

export function PageBody({
  children,
  className,
  /** Forms and reading surfaces want a narrower measure than a data grid. */
  width = 'wide',
}: {
  children: ReactNode
  className?: string
  width?: 'wide' | 'narrow'
}) {
  const embedded = useContext(EmbeddedPageContext)
  if (embedded)
    return <div className={cn('flex min-w-0 flex-col gap-4', className)}>{children}</div>
  return (
    <div
      className={cn(
        // `min-h-0` so a list page's grid can fill this region and scroll
        // itself, rather than pushing the pagination footer off the bottom.
        // `overflow-y-auto` so a page whose content is *not* a self-scrolling
        // grid: a tall form, a reading surface: scrolls here rather than being
        // clipped by the shell's `overflow-hidden` content region. It is inert on
        // a grid page: the grid is `min-h-0 flex-1`, absorbs the slack, and this
        // never overflows to scroll.
        // Tighter top padding pulls the content up under the header, so a list
        // does not open with a band of empty space above its toolbar.
        'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-3 pb-5',
        // A form or reading surface takes a narrow measure; a data grid a wider
        // one. Both centre and cap at `--shell-max`: below it the page fills the
        // width (a 1440 screen is edge-to-edge), above it the content centres in
        // a readable column rather than the table sprawling across a 2560 screen.
        // This replaces both the old `max-w-[1440px]` (which capped but pinned
        // left, leaving a dead band) and the bare `w-full` (which fixed the band
        // but let big screens stretch the rows apart).
        width === 'narrow' ? 'mx-auto w-full max-w-3xl' : 'mx-auto w-full max-w-[var(--shell-max)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
