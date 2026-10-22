import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { SectionEmpty } from '../feedback/SectionEmpty'
import type { EmptyScene } from '../feedback/SceneIllustration'
import { ErrorState, type ErrorKind } from '../feedback/States'
import { TableSkeleton, type SkeletonColumn } from '../feedback/Skeletons'

export const SubTabStateProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/feedback/States',
    'compositions/feedback/SectionEmpty',
    'compositions/feedback/Skeletons',
  ],
  note: 'One boundary for a detail page sub-tab: rows win, then error with retry, then a shaped skeleton, then contextual empty. A failed or loading sub-query can never read as "none yet".',
})

/**
 * A sub-tab's query, shaped for a view that takes no query client. The console
 * page maps `useQuery` onto this: `isLoading` is `isPending`, `error` the
 * sentence from `toListFailure`.
 */
export interface SubTabQuery {
  isLoading: boolean
  error?: string | null | undefined
  errorKind?: ErrorKind | undefined
  retryAfterMs?: number | undefined
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
}

export interface SubTabStateProps {
  /** A row (or any real content) is on screen. Data on screen always wins. */
  hasData: boolean
  isLoading: boolean
  /** The sentence for a failed load. Presence means the query errored. */
  error?: string | null | undefined
  errorKind?: ErrorKind | undefined
  retryAfterMs?: number | undefined
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
  /**
   * What nothing-here-yet says, specific to this tab. No action: the tab's
   * create button is in its `Section` header, top right, empty or not.
   */
  empty: {
    title: string
    description?: string | undefined
    scene?: EmptyScene | undefined
  }
  /** Skeleton columns that mirror the real table. */
  columns?: number | SkeletonColumn[] | undefined
  /** Label the skeleton announces. */
  loadingLabel?: string | undefined
  /** Shown when the list is capped: "Showing the latest 50". */
  truncation?: string | null | undefined
  children: ReactNode
}

/**
 * The body of a sub-tab (payments, credit memos, entitlements, prices, wallet
 * transactions...). Replaces the pattern "isLoading ? skeleton : rows.length ?
 * table : empty", which renders a failed query as an empty list.
 */
export function SubTabState({
  hasData,
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
  empty,
  columns = 4,
  loadingLabel = 'Loading',
  truncation,
  children,
}: SubTabStateProps) {
  if (hasData) {
    return (
      <>
        {children}
        {truncation ? (
          <p className="text-muted-foreground border-t px-6 py-3 text-xs">{truncation}</p>
        ) : null}
      </>
    )
  }
  if (error) {
    return (
      <ErrorState
        title={error}
        {...(errorKind ? { kind: errorKind } : {})}
        {...(onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
        {...(retryAfterMs !== undefined ? { retryAfterMs } : {})}
      />
    )
  }
  if (isLoading) {
    return <TableSkeleton columns={columns} rows={4} rowHeight={44} label={loadingLabel} />
  }
  return <SectionEmpty title={empty.title} description={empty.description} scene={empty.scene} />
}

/**
 * A tab-label count, or undefined while it is not known. A loading or failed
 * sub-query must never show "0": an omitted count says "not loaded", a zero
 * says "none".
 */
export function knownCount(
  count: number | undefined,
  state: { isLoading: boolean; error?: string | null | undefined },
): number | undefined {
  if (state.isLoading || state.error) return undefined
  return count
}

/** "Showing the latest 50" when a list is capped, otherwise null. */
export function truncationNote(shown: number, limit: number): string | null {
  return shown >= limit ? `Showing the latest ${shown}. Older entries are not listed here.` : null
}
