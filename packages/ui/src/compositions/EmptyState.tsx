import type { ReactNode } from 'react'
import { IconStack } from '@ui/components/reui/icon-stack'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/primitives/empty'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Nothing here — and what to do about it.
 *
 * Two situations get confused constantly, so they are separate props rather
 * than one message: a surface with no data *yet* wants an invitation to create
 * the first one; a filter matching nothing wants an offer to clear it. Showing
 * "Create your first feature" to someone who just typed a search is the
 * failure this exists to prevent.
 *
 * Built on `Empty` with `@reui/icon-stack` for the illustration, following
 * `@reui/empty-state-1`: media, title, description, actions, and an optional
 * row of guides underneath. The layered stack is deliberately abstract — a
 * literal drawing of an invoice would be wrong on six of the pages that use
 * this, and a bespoke illustration per surface is a cost nobody signed up for.
 *
 * `size` is the real decision. A whole blank page earns an illustration and
 * space; an empty table body inside a page that already has a heading and a
 * toolbar does not, and giving it one pushes the toolbar off screen.
 *
 * `role="status"` so the change is announced when a filter empties a list — a
 * sighted user watches the rows vanish, and nobody else is told.
 */
export const EmptyStateProvenance = provenance({
  source: 'composition',
  composes: ['@reui/icon-stack', 'ui/empty'],
  note: 'Empty + IconStack, after empty-state-1. Distinguishes "none yet" from "none matching".',
})

export interface EmptyStateProps {
  title: string
  description?: string
  /** Primary action — usually "create the first one". */
  action?: ReactNode
  /** Beside the primary. An import, a link to the docs. */
  secondaryAction?: ReactNode
  /** Shown instead when a filter is responsible for the emptiness. */
  isFiltered?: boolean
  onClearFilters?: ReactNode
  /** The glyph inside the stack. Falls back to the stack's own default. */
  icon?: ReactNode
  /**
   * `page` fills a blank screen — illustration, room to breathe.
   * `inline` sits inside a table body that already has a heading above it.
   */
  size?: 'page' | 'inline'
  /** A short row of links under the actions, as `empty-state-1` has it. */
  guides?: ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  isFiltered = false,
  onClearFilters,
  icon,
  size = 'page',
  guides,
}: EmptyStateProps) {
  const isPage = size === 'page'
  const actions = isFiltered ? onClearFilters : action

  return (
    <Empty
      role="status"
      className={cn(
        'flex-none border-0 bg-transparent',
        isPage ? 'gap-6 px-6 py-14' : 'gap-3 px-6 py-10',
      )}
    >
      <EmptyHeader className={cn('max-w-[27rem]', isPage ? 'gap-4' : 'gap-2')}>
        {isPage ? (
          <EmptyMedia className="mb-0">
            <IconStack aria-hidden>{icon}</IconStack>
          </EmptyMedia>
        ) : icon ? (
          <EmptyMedia className="mb-0 text-muted-foreground">{icon}</EmptyMedia>
        ) : null}

        <div className="flex flex-col items-center gap-1.5">
          <EmptyTitle
            className={cn(
              'tracking-tight',
              isPage ? 'text-lg font-semibold' : 'text-sm font-medium',
            )}
          >
            {title}
          </EmptyTitle>
          {description ? (
            <EmptyDescription
              className={cn('max-w-[24rem]', isPage ? 'text-sm/relaxed' : 'text-xs')}
            >
              {description}
            </EmptyDescription>
          ) : null}
        </div>
      </EmptyHeader>

      {actions || secondaryAction ? (
        <EmptyContent className="max-w-none gap-0">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {actions}
            {/* Only on the first-run state: a filtered miss has one way out. */}
            {isFiltered ? null : secondaryAction}
          </div>
        </EmptyContent>
      ) : null}

      {guides && isPage && !isFiltered ? (
        <div className="w-full max-w-[34rem] space-y-3 pt-4">
          <p className="text-muted-foreground text-sm">Quick guides</p>
          {guides}
        </div>
      ) : null}
    </Empty>
  )
}
