import { FileMinusIcon } from 'lucide-react'
import { type CreditNoteQuery } from '@fp/domain'
import { ApiError, useCreditNotes } from '@fp/query'
import { CreditNoteGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface CreditNoteListPageProps {
  query: CreditNoteQuery
  onQueryChange: (query: CreditNoteQuery) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function CreditNoteListPage({ query, onQueryChange }: CreditNoteListPageProps) {
  const creditNotes = useCreditNotes(query)

  const rows = creditNotes.data?.creditNotes ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={creditNotes.isPending}
        error={toFailure(creditNotes.error)}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void creditNotes.refetch()}
        onClearFilters={clearFilters}
        emptyIcon={<FileMinusIcon aria-hidden />}
        emptyTitle="No credit notes yet"
        emptyDescription="Credit notes refund or adjust an invoice after it has been issued."
      >
        <CreditNoteGrid
          creditNotes={rows}
          total={creditNotes.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onClearFilters={clearFilters}
        />
      </ListState>
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to credit notes here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading credit notes.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading credit notes.', canRetry: true }
}
