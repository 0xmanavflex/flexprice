import { InfoIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DataFreshness } from '@ui/compositions/feedback/DataBoundary'
import { RetryAction } from '@ui/compositions/feedback/RetryAction'
import { SkeletonRegion, ValuePlaceholder } from '@ui/compositions/feedback/Skeletons'

export const CollectionsSummaryProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/feedback/DataBoundary',
    'compositions/feedback/RetryAction',
    'compositions/feedback/Skeletons',
  ],
  note: 'Two-cell strip above a collections table: total overdue and total outstanding, each with a count beneath. Loading is announced, a failure says "Unavailable" with a retry, and caveats (partial read, other currencies) sit in a footer.',
})

export interface CollectionsSummaryCell {
  label: string
  /**
   * Formatted by the caller. `null` is a figure that is genuinely empty (nothing
   * is owed) and shows a dash; a figure that is loading or failed is not
   * `null`, it is the strip's `isLoading` / `isUnavailable`.
   */
  value: string | null
  hint: string
  /** `danger` colours the hint, never the figure. */
  tone?: 'danger'
}

export interface CollectionsSummaryProps {
  cells: readonly CollectionsSummaryCell[]
  /** Nothing to show yet. Bars stand in for the figures and the region announces itself. */
  isLoading?: boolean
  /** It failed and there is no earlier copy. "Unavailable", never a zero. */
  isUnavailable?: boolean
  onRetry?: () => void
  isRetrying?: boolean
  /** The last refresh failed; the figures are the previous good copy. */
  stale?: boolean
  /** A refresh is running over figures already on screen. */
  refreshing?: boolean
  /** `dataUpdatedAt`, for the "from 3 min ago" line. */
  updatedAt?: number | undefined
  /**
   * Caveats about what the figures cover, one sentence each: a partial read, or
   * invoices in a currency the totals leave out.
   */
  notes?: readonly string[]
  className?: string
}

/**
 * What customers owe, before the list of every attempt to collect it.
 *
 * One bordered surface divided into cells rather than separate cards, so the
 * figures read as a single statement. The number stays in the foreground colour;
 * only the hint underneath turns red, so a large overdue total does not shout
 * louder than the page title.
 *
 * Billing correctness over tidiness: a total that is loading or could not be
 * read is never drawn as "$0.00". It is a bar (loading) or the word
 * "Unavailable" (failed), and anything the total leaves out is said in the
 * footer, next to the figure it qualifies.
 */
export function CollectionsSummary({
  cells,
  isLoading = false,
  isUnavailable = false,
  onRetry,
  isRetrying = false,
  stale = false,
  refreshing = false,
  updatedAt,
  notes = [],
  className,
}: CollectionsSummaryProps) {
  const showFreshness = !isLoading && !isUnavailable && (stale || refreshing)
  const footer = !isLoading && (isUnavailable || showFreshness || notes.length > 0)

  return (
    <section
      aria-label="Collections summary"
      className={cn('bg-background flex flex-col rounded-xl border', className)}
    >
      <div className={cn('grid sm:divide-x', cells.length > 1 ? 'sm:grid-cols-2' : '')}>
        {cells.map((cell, index) =>
          isLoading ? (
            <SkeletonRegion
              key={cell.label}
              label="Loading collections summary"
              announce={index === 0}
              className="flex flex-col gap-1 px-6 py-5"
            >
              <p className="text-muted-foreground text-[13px]">{cell.label}</p>
              <p className="text-2xl font-medium tracking-tight">
                <ValuePlaceholder width={10} label={`Loading ${cell.label.toLowerCase()}`} />
              </p>
              {/* Holds the hint's line height so the strip does not grow when it lands. */}
              <p aria-hidden className="text-xs">
                &nbsp;
              </p>
            </SkeletonRegion>
          ) : (
            <div key={cell.label} className="flex flex-col gap-1 px-6 py-5">
              <p className="text-muted-foreground text-[13px]">{cell.label}</p>
              {isUnavailable ? (
                <p className="text-muted-foreground text-2xl font-medium tracking-tight">
                  Unavailable
                </p>
              ) : (
                <p
                  className={cn(
                    'text-2xl font-medium tracking-tight tabular-nums',
                    // The figures on screen are the previous copy; dim them rather than pass them off as current.
                    stale && 'text-foreground/70',
                  )}
                >
                  {cell.value ?? '—'}
                </p>
              )}
              <p
                className={cn(
                  'text-xs',
                  !isUnavailable && cell.tone === 'danger'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {isUnavailable ? 'Not loaded' : cell.hint}
              </p>
            </div>
          ),
        )}
      </div>

      {footer ? (
        <div className="flex flex-col gap-2 border-t px-6 py-3">
          {isUnavailable ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-foreground/80">
                Couldn’t load what customers owe. The list below is unaffected.
              </span>
              {onRetry ? <RetryAction onRetry={onRetry} isRetrying={isRetrying} /> : null}
            </div>
          ) : null}
          {showFreshness ? (
            <DataFreshness
              updatedAt={updatedAt}
              refreshing={refreshing}
              stale={stale}
              {...(onRetry ? { onRefresh: onRetry } : {})}
            />
          ) : null}
          {notes.map((note) => (
            <p
              key={note}
              className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
            >
              <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
