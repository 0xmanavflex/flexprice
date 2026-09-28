import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'

/**
 * A detail page's header: where you are, what this is, and what you can do to it.
 *
 * The same shape as `PageHeader`, with the two things a detail page needs that a
 * list page does not: a row of status/type badges under the title, and a
 * monospaced identifier (the lookup key or id) so the record is quotable. Shared
 * so every entity's detail page opens the same way rather than each arranging a
 * title, a chip and a button row of its own.
 *
 * `actions` is the one primary control plus its overflow, kept to the right of
 * the title where a detail page's actions belong.
 */
export const DetailHeaderProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Shared detail-page header: breadcrumb, title, badges, identifier, actions.',
})

export interface DetailHeaderProps {
  title: string
  /** Status and type chips, rendered in a row under the title. */
  badges?: ReactNode
  /** The lookup key or id, shown monospaced beside the badges. */
  identifier?: string
  description?: string
  /** The primary action and any overflow menu. */
  actions?: ReactNode
  breadcrumb?: ReactNode
}

export function DetailHeader({
  title,
  badges,
  identifier,
  description,
  actions,
  breadcrumb,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 px-6 pt-5 pb-4">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="truncate text-xl font-semibold">{title}</h1>
            {badges}
            {identifier ? (
              <span className="truncate font-mono text-xs text-muted-foreground">{identifier}</span>
            ) : null}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
