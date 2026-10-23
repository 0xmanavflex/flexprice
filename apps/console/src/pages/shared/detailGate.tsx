import type { ReactNode } from 'react'
import { ApiError } from '@fp/query'
import { ErrorState, PageBody, PageLoadingState } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { RecordElsewhere } from './RecordElsewhere'
import { toListFailure } from './listFailure'

export interface DetailGateQuery {
  isPending: boolean
  isFetching: boolean
  error: unknown
  refetch: () => unknown
}

export interface DetailGateOptions {
  /** What was being loaded: "this invoice", "this customer". */
  noun: string
  /** What the list is called: "invoices". Names the back button. */
  listName: string
  onBack: () => void
  /**
   * The record's API path, e.g. `/invoices/inv_1`. On a 404 the record is
   * looked for in the person's other environments before "not found" — a
   * shared link names the record, not its environment.
   */
  recordPath?: string
}

/**
 * What a detail page shows when it has no record to draw. Call it only when
 * `query.data` is missing: a record already on screen outranks a failed
 * refetch, so the caller renders the page whenever it has data.
 *
 * Loading is a page-shaped skeleton. A 404 is "not found" with a way back to
 * the list, never a retry (retrying a deleted record cannot work). Any other
 * failure keeps its own kind, and "Try again" refetches the same query; it
 * never navigates away.
 */
export function detailGate(query: DetailGateQuery, options: DetailGateOptions): ReactNode {
  const { noun, listName, onBack, recordPath } = options
  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      Back to {listName}
    </Button>
  )

  if (query.isPending && !query.error) {
    return (
      <PageBody>
        <PageLoadingState variant="detail" label={`Loading ${noun}`} />
      </PageBody>
    )
  }

  const notFound =
    !query.error || (query.error instanceof ApiError && query.error.kind === 'not_found')
  if (notFound) {
    const name = noun.replace(/^this /, '')
    const missing = (
      <PageBody>
        <ErrorState
          variant="page"
          kind="unavailable"
          title={`${name.charAt(0).toUpperCase()}${name.slice(1)} not found`}
          description="It may have been deleted, or the link may be wrong."
          action={back}
        />
      </PageBody>
    )
    // A real 404 only: with no error the record simply has not arrived.
    return query.error && recordPath ? (
      <RecordElsewhere path={recordPath} noun={noun} notFound={missing} />
    ) : (
      missing
    )
  }

  const failure = toListFailure(query.error, noun)
  return (
    <PageBody>
      <ErrorState
        variant="page"
        title={failure?.message ?? `Could not load ${noun}.`}
        kind={failure?.kind ?? 'generic'}
        {...(failure?.canRetry ? { onRetry: () => void query.refetch() } : {})}
        isRetrying={query.isFetching}
        {...(failure?.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {})}
        action={back}
      />
    </PageBody>
  )
}
