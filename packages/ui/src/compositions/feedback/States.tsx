import type { ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { ListOfferProvider, type ListOffer } from './EmptyState'
import { provenance } from '@ui/provenance'

/**
 * The five states every screen has, designed once.
 *
 * Defined together rather than per screen so they cannot diverge, and so a
 * screen has to *choose* a state rather than fall into whatever its absence of
 * data renders. The current dashboard's screens each invented their own, which
 * is why some show a spinner, some a blank table, and some nothing at all.
 *
 *   Loading           a skeleton shaped like the result, never a page spinner
 *   Empty (no data)   nothing exists yet — offer to create the first
 *   Empty (filtered)  nothing matched — offer to clear the filter
 *   Error (retryable) something broke and trying again might work
 *   Error (denied)    permission; retrying cannot help, so do not offer it
 */
export const StatesProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/skeleton'],
  note: 'The five screen states, defined once so screens cannot invent their own.',
})

/**
 * A skeleton shaped like the table that will replace it.
 *
 * A centred spinner tells you the page is busy; a skeleton tells you what is
 * coming and stops the layout jumping when it arrives.
 */
export function LoadingRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className="h-9 flex-1"
              // The first column is usually a name and reads longer.
              style={column === 0 ? { flex: 2 } : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export interface ErrorStateProps {
  title: string
  description?: string
  /**
   * Omitted when retrying cannot help.
   *
   * Offering "Try again" on a permission error is worse than offering nothing:
   * it invites someone to keep pressing a button that will always fail.
   */
  onRetry?: () => void
  action?: ReactNode
}

export function ErrorState({ title, description, onRetry, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/10 flex flex-col items-start gap-3 rounded-xl border p-6"
    >
      {/*
        `-foreground` on a tinted surface, and plain foreground for the body.
        Full-saturation destructive measures 4.36:1 on its own tint and
        `text-muted-foreground` measures 4.33:1 — both under AA. ReUI's own
        `-light` variants pair the tint with `-foreground` for this reason.
      */}
      <p className="text-destructive-foreground dark:text-destructive text-sm font-medium">
        {title}
      </p>
      {description ? <p className="text-foreground/80 text-sm">{description}</p> : null}
      <div className="flex gap-2">
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  )
}

export interface ListStateProps {
  isLoading: boolean
  error: { message: string; canRetry: boolean } | null
  isEmpty: boolean
  isFiltered: boolean
  onRetry?: () => void
  /**
   * What to offer when nothing exists yet.
   *
   * Rendered twice, from one node: pinned at the end of the grid's toolbar,
   * and again in the empty table body on the first run. A list whose only
   * create button lives in its empty state loses it the moment the first
   * record exists.
   */
  createAction?: ReactNode
  /**
   * Kept because pages pass the same handler to the grid, which owns the
   * filtered miss now — its empty body renders "clear filters" without taking
   * the toolbar down with it, which is the whole point.
   */
  onClearFilters?: () => void
  emptyTitle: string
  emptyDescription?: string
  /** The glyph for the first-run state. Sits inside the illustration. */
  emptyIcon?: ReactNode
  /** Beside the primary action — an import, a link to the docs. */
  emptySecondaryAction?: ReactNode
  children: ReactNode
}

/**
 * Picks the right state for a list, in the order that matters.
 *
 * Error before loading, because a failed refetch must not be hidden behind a
 * skeleton. Both replace the list, because there is nothing to show and no
 * toolbar can act on it.
 *
 * Empty does not. An empty list is still a list: it keeps its toolbar, its
 * filters and its footer, and says "nothing here yet" in the table body where
 * the rows would be. The distinction between "no results" and "nothing here
 * yet" survives — the page states which one it is, and the grid's empty body
 * renders the right offer — so nobody is shown "create your first" because
 * they typed a search.
 */
export function ListState({
  isLoading,
  error,
  isEmpty,
  isFiltered,
  onRetry,
  createAction,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptySecondaryAction,
  children,
}: ListStateProps) {
  if (error) {
    return (
      <ErrorState
        title={error.message}
        {...(error.canRetry && onRetry ? { onRetry } : {})}
        {...(error.canRetry
          ? {}
          : { description: 'Ask an administrator if you need access to this.' })}
      />
    )
  }

  if (isLoading) return <LoadingRows />

  /*
   * Empty does *not* mean "render something else instead".
   *
   * It used to: an empty list returned an `EmptyState` in place of `children`,
   * and since the toolbar, the search box, the filters and the pagination are
   * all children of the grid, an empty list was a page with no way to search
   * it, no way to filter it, and — worst — no way to create the first record
   * the empty state was inviting you to create. The invitation and the button
   * that answers it were in different components, and only one of them
   * survived.
   *
   * So the grid always renders, and what the page would have said is published
   * instead: the toolbar pins the create action at its end, and the grid's own
   * empty table body says "nothing here yet" where the rows would be.
   */
  const offer: ListOffer = {
    isFirstRun: isEmpty && !isFiltered,
    title: emptyTitle,
    description: emptyDescription,
    ...(emptyIcon ? { icon: emptyIcon } : {}),
    ...(emptySecondaryAction ? { secondaryAction: emptySecondaryAction } : {}),
    ...(createAction ? { action: createAction } : {}),
  }

  return <ListOfferProvider value={offer}>{children}</ListOfferProvider>
}
