import { useEffect, useRef, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'
import { RefreshCwIcon } from '@ui/icons'
import { SubTabState, truncationNote, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { DetailTable } from '../shared/DetailTable'

/** One ingested event for a customer, as the events grid shows it. */
export interface CustomerEvent {
  id: string
  name: string
  properties: Record<string, string>
  source: string
  /** Already formatted for display; empty when the event carries no timestamp. */
  receivedAt: string
  /** The same moment in epoch milliseconds, for sorting; 0 when unknown. */
  receivedAtMs?: number | undefined
}

const summarize = (properties: Record<string, string>) =>
  Object.entries(properties)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

/** The most recent events the customer page asks for. */
export const CUSTOMER_EVENTS_LIMIT = 50

export interface CustomerEventsGridProps extends Partial<SubTabQuery> {
  events: CustomerEvent[]
  /** Events the customer has in all, when the read reports it; shown beside the cap. */
  total?: number | undefined
  /**
   * Opens one event in the page's own detail view (the Events debugger sheet,
   * with its trace and processed usage). Omitted, the grid shows a minimal
   * sheet of the event's properties itself.
   */
  onOpenEvent?: ((eventId: string) => void) | undefined
  /**
   * Adds a Refresh button to the section header (V1's manual refresh): events
   * are ingested continuously and the list does not poll. In the header, not
   * the table toolbar, so it is there while the list is still empty.
   */
  onRefresh?: (() => void) | undefined
  /** A refresh is in flight: the button is disabled and its icon spins. */
  isRefreshing?: boolean | undefined
  /**
   * Loads the next page of events. Given, the list grows as it is scrolled
   * (and from a "Load more" button) instead of stopping at one page.
   */
  onLoadMore?: (() => void) | undefined
  /** There are more events to load. */
  hasMore?: boolean | undefined
  isLoadingMore?: boolean | undefined
  /**
   * The last "load more" failed: the list says why, and offers a retry only
   * when one can succeed (not after a denial), after any cooldown has passed.
   */
  loadMoreError?: LoadMoreError | null | undefined
}

export interface LoadMoreError {
  message: string
  canRetry: boolean
  /** A rate limit's cooldown: Try again waits this long. */
  retryAfterMs?: number | undefined
}

/** Every loaded row on one table page: the list grows by loading, not paging. */
const ALL_ROWS = Number.MAX_SAFE_INTEGER

export function CustomerEventsGrid({
  events,
  total,
  isLoading = false,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
  onOpenEvent,
  onRefresh,
  isRefreshing = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  loadMoreError = null,
}: CustomerEventsGridProps) {
  const loadMoreFailed = loadMoreError !== null
  // A rate limit's cooldown holds the retry back until it has passed.
  const [coolingDown, setCoolingDown] = useState(false)
  useEffect(() => {
    const wait = loadMoreError?.retryAfterMs
    if (!wait) return
    setCoolingDown(true)
    const timer = setTimeout(() => setCoolingDown(false), wait)
    return () => clearTimeout(timer)
  }, [loadMoreError])
  const [selected, setSelected] = useState<CustomerEvent | null>(null)
  const capped = onLoadMore
    ? undefined
    : total !== undefined && total > events.length
      ? `Showing the latest ${events.length} of ${total} events.`
      : truncationNote(events.length, CUSTOMER_EVENTS_LIMIT)

  // Reaching the end of the list asks for the next page, so it reads as one
  // continuous log; the button below does the same for keyboard and AT users.
  const sentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = sentinel.current
    // After a failure the retry is the reader's: scrolling must not loop on it.
    if (
      !node ||
      !onLoadMore ||
      !hasMore ||
      loadMoreFailed ||
      typeof IntersectionObserver === 'undefined'
    )
      return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isLoadingMore) onLoadMore()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore, loadMoreFailed])

  return (
    <>
      <Section
        table
        title="Recent events"
        {...(onRefresh
          ? {
              action: (
                <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
                  <RefreshCwIcon
                    aria-hidden
                    className={isRefreshing ? 'animate-spin' : undefined}
                  />
                  Refresh
                </Button>
              ),
            }
          : {})}
      >
        <SubTabState
          hasData={events.length > 0}
          isLoading={isLoading}
          error={error}
          errorKind={errorKind}
          retryAfterMs={retryAfterMs}
          onRetry={onRetry}
          isRetrying={isRetrying}
          columns={4}
          loadingLabel="Loading events"
          {...(capped ? { truncation: capped } : {})}
          empty={{
            scene: 'customers',
            title: 'No events yet',
            description: 'Events ingested for this customer appear here as they arrive.',
          }}
        >
          <DetailTable
            label="Recent events"
            noun="events"
            rows={events}
            // Every loaded event on one page: the list grows by loading more,
            // not by paging through what is already here.
            {...(onLoadMore ? { pageSize: ALL_ROWS, footer: false } : {})}
            facets={[
              { id: 'name', label: 'Event', value: (e: CustomerEvent) => e.name },
              { id: 'source', label: 'Source', value: (e: CustomerEvent) => e.source || '—' },
            ]}
            getRowId={(event) => event.id}
            onRowClick={(event) => (onOpenEvent ? onOpenEvent(event.id) : setSelected(event))}
            columns={[
              {
                key: 'name',
                header: 'Event',
                cell: (e) => <span className="font-mono text-[13px]">{e.name}</span>,
              },
              {
                key: 'properties',
                header: 'Properties',
                cell: (e) => (
                  <span className="text-muted-foreground block max-w-md truncate font-mono text-xs">
                    {summarize(e.properties)}
                  </span>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                cell: (e) => <span className="text-muted-foreground">{e.source || '—'}</span>,
              },
              {
                key: 'at',
                header: 'Received',
                sortBy: (e) => e.receivedAtMs ?? 0,
                cell: (e) => <span className="text-muted-foreground">{e.receivedAt || '—'}</span>,
              },
            ]}
            empty="No events yet. Events ingested for this customer appear here as they arrive."
          />
          {onLoadMore && hasMore ? (
            <div ref={sentinel} className="flex flex-col items-center gap-2 border-t py-3">
              {loadMoreError && !isLoadingMore ? (
                <p role="alert" className="text-muted-foreground text-[13px]">
                  {loadMoreError.message}
                </p>
              ) : null}
              {loadMoreError && !loadMoreError.canRetry ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoadingMore || coolingDown}
                >
                  {isLoadingMore ? 'Loading…' : loadMoreFailed ? 'Try again' : 'Load more events'}
                </Button>
              )}
            </div>
          ) : null}
        </SubTabState>
      </Section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => (open ? undefined : setSelected(null))}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">{selected?.name}</SheetTitle>
            <SheetDescription>
              Received {selected?.receivedAt || 'at an unknown time'} via{' '}
              {selected?.source || 'an unknown source'}
            </SheetDescription>
          </SheetHeader>
          <dl className="flex flex-col gap-3 px-4 text-sm">
            {Object.entries(selected?.properties ?? {}).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{key}</dt>
                <dd className="font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </SheetContent>
      </Sheet>
    </>
  )
}
