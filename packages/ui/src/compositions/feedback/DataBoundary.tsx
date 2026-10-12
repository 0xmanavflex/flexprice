import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { DataState } from './dataState'
import { formatAge, nextTickMs } from './freshness'
import type { LoadingGateOptions } from './loadingGate'
import { RetryAction } from './RetryAction'
import { useLoadingPhase } from './useLoadingPhase'

export const DataBoundaryProvenance = provenance({
  source: 'composition',
  composes: ['compositions/feedback/RetryAction'],
  note: 'Loading gate, refresh bar, freshness label, partial-data notice and a region that keeps stale content visible.',
})

/**
 * Shows `fallback` only when a load is slow enough to be noticed, holds its
 * space from the first frame so nothing shifts, and keeps it up long enough
 * not to strobe. After `slowMs` it adds a plain "taking longer" line, so a
 * slow API is never hidden behind an endless skeleton.
 */
export function Deferred({
  loading,
  fallback,
  children,
  gate,
  slowMessage = 'This is taking longer than usual. The data is still on its way.',
}: {
  loading: boolean
  fallback: ReactNode
  children: ReactNode
  gate?: LoadingGateOptions
  slowMessage?: string
}) {
  const phase = useLoadingPhase(loading, gate)
  const drawn = phase === 'visible' || phase === 'slow'
  if (!loading && !drawn) return <>{children}</>
  return (
    <>
      <div aria-hidden={!drawn || undefined} className={drawn ? undefined : 'invisible'}>
        {fallback}
      </div>
      {phase === 'slow' ? (
        <p role="status" className="text-muted-foreground pt-3 text-sm">
          {slowMessage}
        </p>
      ) : null}
    </>
  )
}

/**
 * A slim bar across the top of the nearest `relative` ancestor while data is
 * updating in the background. Waits 300ms so a fast refetch draws nothing.
 */
export function RefreshingIndicator({
  active,
  label = 'Updating',
  className,
}: {
  active: boolean
  label?: string
  className?: string
}) {
  const phase = useLoadingPhase(active, { delayMs: 300, minMs: 500, slowMs: 3_600_000 })
  const shown = phase === 'visible' || phase === 'slow'
  return (
    <>
      {shown ? (
        <div
          aria-hidden
          className={cn(
            'fp-refresh-bar text-primary/70 pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-full',
            className,
          )}
        />
      ) : null}
      <span role="status" className="sr-only">
        {shown ? `${label}…` : ''}
      </span>
    </>
  )
}

function useAge(updatedAt: number | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (updatedAt === undefined) return
    const timer = setTimeout(() => setNow(Date.now()), nextTickMs(Date.now() - updatedAt))
    return () => clearTimeout(timer)
  }, [updatedAt, now])
  return updatedAt === undefined ? undefined : Math.max(0, now - updatedAt)
}

export interface DataFreshnessProps {
  /** `dataUpdatedAt` from the query: epoch milliseconds. */
  updatedAt: number | undefined
  refreshing?: boolean
  /** The last refresh failed; what is shown is the last good copy. */
  stale?: boolean
  onRefresh?: () => void
  className?: string
}

/**
 * "Updated 3 min ago", and when a refresh has failed, the plain statement that
 * the figures on screen are from then, not now.
 */
export function DataFreshness({
  updatedAt,
  refreshing = false,
  stale = false,
  onRefresh,
  className,
}: DataFreshnessProps) {
  const age = useAge(updatedAt)
  if (updatedAt === undefined || age === undefined) return null
  const when = formatAge(age)
  const full = new Date(updatedAt)
  return (
    <span
      role={stale ? 'status' : undefined}
      className={cn('text-muted-foreground inline-flex items-center gap-2 text-xs', className)}
    >
      {stale ? (
        <>
          <span aria-hidden className="bg-warning size-1.5 rounded-full" />
          <span className="text-foreground/80">
            Couldn’t refresh. Showing data from <time dateTime={full.toISOString()}>{when}</time>.
          </span>
          {onRefresh ? (
            <RetryAction onRetry={onRefresh} isRetrying={refreshing} size="sm" variant="ghost" />
          ) : null}
        </>
      ) : (
        <time dateTime={full.toISOString()} title={full.toLocaleString()} className="tabular-nums">
          {refreshing ? 'Updating…' : `Updated ${when}`}
        </time>
      )}
    </span>
  )
}

export interface PartialDataNoticeProps {
  /** Names of the sections that failed, e.g. `['Revenue', 'Usage']`. */
  failed: string[]
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
}

/**
 * One line when part of a page failed and the rest is good. Says which part,
 * says the rest is current, and offers a retry for just that part.
 */
export function PartialDataNotice({
  failed,
  onRetry,
  isRetrying,
  className,
}: PartialDataNoticeProps) {
  if (failed.length === 0) return null
  const names =
    failed.length === 1 ? failed[0] : `${failed.slice(0, -1).join(', ')} and ${failed.at(-1)}`
  return (
    <div
      role="status"
      className={cn(
        'border-warning/30 bg-warning/10 text-foreground/80 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
        className,
      )}
    >
      <span>{names} couldn’t be loaded. Everything else on this page is up to date.</span>
      {onRetry ? (
        <RetryAction onRetry={onRetry} {...(isRetrying !== undefined ? { isRetrying } : {})} />
      ) : null}
    </div>
  )
}

/**
 * Wraps content that is already on screen. While the next copy loads it stays
 * put: a thin bar says it is updating, and if the data belongs to a previous
 * filter or page it is dimmed and marked `aria-busy`, so nobody reads it as the
 * answer to the question they just asked.
 */
export function DataRegion({
  state,
  children,
  className,
}: {
  state: Pick<DataState, 'refreshing' | 'provisional'>
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('relative', className)}
      aria-busy={state.refreshing || state.provisional || undefined}
    >
      <RefreshingIndicator active={state.refreshing} />
      <div
        className={cn(
          'transition-opacity duration-150 motion-reduce:transition-none',
          state.provisional ? 'opacity-60' : null,
        )}
      >
        {children}
      </div>
    </div>
  )
}
