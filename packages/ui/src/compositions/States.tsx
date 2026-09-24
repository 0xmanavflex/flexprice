import type { ReactNode } from 'react'
import { Button } from '@ui/primitives/button'
import { Skeleton } from '@ui/primitives/skeleton'
import { EmptyState } from './EmptyState'
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
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6"
    >
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
  /** What to offer when nothing exists yet. */
  createAction?: ReactNode
  onClearFilters?: () => void
  emptyTitle: string
  emptyDescription?: string
  children: ReactNode
}

/**
 * Picks the right state for a list, in the order that matters.
 *
 * Error before loading, because a failed refetch must not be hidden behind a
 * skeleton. Filtered-empty before empty, because "no results" and "nothing
 * here yet" are different situations with different offers, and showing
 * "create your first" to someone who just typed a search is the confusion this
 * prevents.
 */
export function ListState({
  isLoading,
  error,
  isEmpty,
  isFiltered,
  onRetry,
  createAction,
  onClearFilters,
  emptyTitle,
  emptyDescription,
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

  if (isEmpty) {
    return isFiltered ? (
      <EmptyState
        title="Nothing matches these filters"
        description="Try a different search, or clear the filters to see everything."
        isFiltered
        onClearFilters={
          onClearFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />
    ) : (
      <EmptyState
        title={emptyTitle}
        {...(emptyDescription ? { description: emptyDescription } : {})}
        {...(createAction ? { action: createAction } : {})}
      />
    )
  }

  return <>{children}</>
}
