import { useState } from 'react'
import { ScrollTextIcon } from 'lucide-react'
import { type RawEvent, type RawEventQuery } from '@fp/domain'
import { ApiError, useRawEvents } from '@fp/query'
import { EventDetailSheet, EventGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface EventListPageProps {
  query: RawEventQuery
  onQueryChange: (query: RawEventQuery) => void
}

/**
 * The wiring layer for the Events Debugger: fetch, turn an error into a
 * sentence, hand the grid plain props. The query lives in the URL; the opened
 * event is ephemeral, so it is the one piece of local state.
 */
export function EventListPage({ query, onQueryChange }: EventListPageProps) {
  const events = useRawEvents(query)
  const [selected, setSelected] = useState<RawEvent | null>(null)

  const rows = events.data?.events ?? []
  const isFiltered = query.search.length > 0 || query.customer.length > 0 || query.source.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', customer: '', source: '', page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={events.isPending}
        error={toFailure(events.error)}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void events.refetch()}
        onClearFilters={clearFilters}
        emptyIcon={<ScrollTextIcon aria-hidden />}
        emptyTitle="No events received yet"
        emptyDescription="Usage events sent by your systems appear here as they arrive, so a bill can be traced to what caused it."
      >
        <EventGrid
          events={rows}
          total={events.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          isLoading={events.isFetching && rows.length === 0}
          onEventClick={setSelected}
          onClearFilters={clearFilters}
        />
      </ListState>
      <EventDetailSheet event={selected} onClose={() => setSelected(null)} />
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to events here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading events.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading events.', canRetry: true }
}
