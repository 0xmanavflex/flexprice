import type { ReactNode } from 'react'
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

export interface PageHeaderProps {
  title: string
  description?: string
  /** The one thing this page is for. A single button, not a row of them. */
  action?: ReactNode
  /** Everything else, behind an overflow menu. */
  menu?: ReactNode
  breadcrumb?: ReactNode
}

export function PageHeader({ title, description, action, menu, breadcrumb }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b px-6 py-5">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action || menu ? (
          <div className="flex shrink-0 items-center gap-2">
            {action}
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
  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-4 px-6 py-5',
        width === 'narrow' ? 'mx-auto w-full max-w-3xl' : 'w-full max-w-[1440px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
