import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DataRegion, PartialDataNotice } from './DataBoundary'
import { ListOfferProvider, type ListOffer } from './EmptyState'
import { Figure, type FigureName } from './Figures'
import { RetryAction } from './RetryAction'
import { Bone, SkeletonRegion } from './Skeletons'

/**
 * The five states every screen has, designed once.
 *
 * Defined together rather than per screen so they cannot diverge, and so a
 * screen has to *choose* a state rather than fall into whatever its absence of
 * data renders. The current dashboard's screens each invented their own, which
 * is why some show a spinner, some a blank table, and some nothing at all.
 *
 *   Loading           a skeleton shaped like the result, never a page spinner
 *   Empty (no data)   nothing exists yet: offer to create the first
 *   Empty (filtered)  nothing matched: offer to clear the filter
 *   Error (retryable) something broke and trying again might work
 *   Error (denied)    permission; retrying cannot help, so do not offer it
 */
export const StatesProvenance = provenance({
  source: 'composition',
  composes: ['compositions/feedback/Skeletons', 'compositions/feedback/RetryAction'],
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
    <SkeletonRegion className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <Bone
              key={column}
              className="h-9 flex-1"
              // The first column is usually a name and reads longer.
              {...(column === 0 ? { style: { flex: 2 } } : {})}
            />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  )
}

/**
 * Why a request failed, in terms that change what the screen says and offers.
 * `denied` never offers a retry; `rate-limited` offers one after a cooldown.
 */
export type ErrorKind =
  'generic' | 'network' | 'timeout' | 'server' | 'rate-limited' | 'denied' | 'unavailable'

const ERROR_COPY: Record<ErrorKind, { figure: FigureName; description: string }> = {
  generic: { figure: 'fault', description: 'Something went wrong loading this.' },
  network: {
    figure: 'plug',
    description: 'We couldn’t reach Flexprice. Check your connection and try again.',
  },
  timeout: {
    figure: 'signal',
    description: 'The request took too long. Your data is safe; try again in a moment.',
  },
  server: {
    figure: 'fault',
    description: 'Flexprice had a problem on its side. Trying again usually works.',
  },
  'rate-limited': {
    figure: 'signal',
    description: 'Too many requests in a short time. Wait a moment, then try again.',
  },
  denied: { figure: 'padlock', description: 'Ask an administrator if you need access to this.' },
  unavailable: { figure: 'drawer', description: 'This isn’t available for your workspace.' },
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
  /** Picks the default description and figure, and withholds retry for `denied`. */
  kind?: ErrorKind
  isRetrying?: boolean
  /** Cooldown before retry is allowed, from a `Retry-After` header. */
  retryAfterMs?: number | undefined
  /** Quoted to support, never shown as the explanation. */
  requestId?: string | undefined
  /** `panel` is the inline box; `page` is centred with a figure, for a whole screen. */
  variant?: 'panel' | 'page'
}

export function ErrorState({
  title,
  description,
  onRetry,
  action,
  kind,
  isRetrying,
  retryAfterMs,
  requestId,
  variant = 'panel',
}: ErrorStateProps) {
  const copy = kind ? ERROR_COPY[kind] : null
  const body = description ?? copy?.description
  const canRetry = onRetry && kind !== 'denied' && kind !== 'unavailable'
  const retry = canRetry ? (
    <RetryAction
      onRetry={onRetry}
      {...(isRetrying !== undefined ? { isRetrying } : {})}
      {...(retryAfterMs !== undefined ? { retryAfterMs } : {})}
    />
  ) : null
  const reference = requestId ? (
    <p className="text-muted-foreground text-xs">Reference: {requestId}</p>
  ) : null

  if (variant === 'page') {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <Figure name={copy?.figure ?? 'fault'} motion="interactive" />
        <div className="flex max-w-[27rem] flex-col items-center gap-1.5">
          <p className="text-lg font-medium tracking-tight">{title}</p>
          {body ? (
            <p className="text-muted-foreground text-sm/relaxed text-balance">{body}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {retry}
          {action}
        </div>
        {reference}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/10 flex flex-col items-start gap-3 rounded-xl border p-6"
    >
      {/*
        `-foreground` on a tinted surface, and plain foreground for the body.
        Full-saturation destructive measures 4.36:1 on its own tint and
        `text-muted-foreground` measures 4.33:1: both under AA. ReUI's own
        `-light` variants pair the tint with `-foreground` for this reason.
      */}
      <p className="text-destructive-foreground dark:text-destructive text-sm font-medium">
        {title}
      </p>
      {body ? <p className="text-foreground/80 text-sm">{body}</p> : null}
      <div className="flex gap-2">
        {retry}
        {action}
      </div>
      {reference}
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
   * filtered miss now: its empty body renders "clear filters" without taking
   * the toolbar down with it, which is the whole point.
   */
  onClearFilters?: () => void
  emptyTitle: string
  emptyDescription?: string
  /** Beside the primary action: an import, a link to the docs. */
  emptySecondaryAction?: ReactNode
  /** Rows are on screen (real or from the previous page/filter). An error then keeps them. */
  hasRows?: boolean
  /** A background request is updating the rows on screen. */
  isRefreshing?: boolean
  /** The rows on screen belong to the previous page or filter. */
  isProvisional?: boolean
  /** Why the failure happened; picks the copy and withholds retry for `denied`. */
  failureKind?: ErrorKind
  isRetrying?: boolean
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
 * yet" survives: the page states which one it is, and the grid's empty body
 * renders the right offer: so nobody is shown "create your first" because
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
  emptySecondaryAction,
  hasRows = false,
  isRefreshing = false,
  isProvisional = false,
  failureKind,
  isRetrying,
  children,
}: ListStateProps) {
  // A failed refresh must not take away rows that were true a moment ago: they
  // stay, with a plain note that they are the last good copy.
  const failedRefresh = error !== null && hasRows
  /*
   * A search or filter that fails keeps the grid: the error replacing it would
   * also take away the search box that caused it, leaving nothing on screen to
   * clear. The grid's empty body says the request failed (see `ListOffer`).
   */
  const failedFilter = error !== null && !hasRows && isFiltered

  if (error && !failedRefresh && !failedFilter) {
    return (
      <ErrorState
        title={error.message}
        {...(failureKind ? { kind: failureKind } : {})}
        {...(error.canRetry && onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
        {...(error.canRetry || failureKind
          ? {}
          : { description: 'Ask an administrator if you need access to this.' })}
      />
    )
  }

  if (isLoading && !hasRows) return <LoadingRows />

  /*
   * Empty does *not* mean "render something else instead".
   *
   * It used to: an empty list returned an `EmptyState` in place of `children`,
   * and since the toolbar, the search box, the filters and the pagination are
   * all children of the grid, an empty list was a page with no way to search
   * it, no way to filter it, and: worst: no way to create the first record
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
    ...(emptySecondaryAction ? { secondaryAction: emptySecondaryAction } : {}),
    ...(createAction ? { action: createAction } : {}),
    ...(failedFilter && error
      ? {
          failure: {
            title: error.message,
            description: 'Change or clear the search and filters, then try again.',
            ...(error.canRetry && onRetry
              ? {
                  action: (
                    <RetryAction
                      onRetry={onRetry}
                      {...(isRetrying !== undefined ? { isRetrying } : {})}
                    />
                  ),
                }
              : {}),
          },
        }
      : {}),
  }

  return (
    <ListOfferProvider value={offer}>
      <DataRegion
        state={{ refreshing: isRefreshing, provisional: isProvisional }}
        className={cn('flex min-w-0 flex-col gap-4')}
      >
        {failedRefresh && error.canRetry ? (
          <PartialDataNotice
            failed={['The latest results']}
            {...(onRetry ? { onRetry } : {})}
            {...(isRetrying !== undefined ? { isRetrying } : {})}
          />
        ) : null}
        {children}
      </DataRegion>
    </ListOfferProvider>
  )
}
