import {
  BILLING_ENTITY_FILTER,
  type CreditNote,
  type CreditNoteQuery,
  withChoiceFilter,
} from '@fp/domain'
import { useBillingEntities, useCreditNotes, useEntityFilterOptions } from '@fp/query'
import { CreditNoteGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface CreditNoteListPageProps {
  query: CreditNoteQuery
  onQueryChange: (query: CreditNoteQuery) => void
  onCreate?: () => void
  onCreditNoteClick?: (creditNote: CreditNote) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function CreditNoteListPage({
  query,
  onQueryChange,
  onCreate,
  onCreditNoteClick,
}: CreditNoteListPageProps) {
  const entityOptions = useEntityFilterOptions()
  const entities = useBillingEntities()
  const creditNotes = useCreditNotes(query, {
    specs: withChoiceFilter([], BILLING_ENTITY_FILTER, entityOptions),
  })
  const failure = toListFailure(creditNotes.error, 'credit memos')

  const rows = creditNotes.data?.creditNotes ?? []
  const isFiltered =
    query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={creditNotes.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (creditNotes.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={creditNotes.isFetching && !creditNotes.isPending}
        isProvisional={creditNotes.isPlaceholderData}
        isRetrying={creditNotes.isFetching && creditNotes.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        isFiltered={isFiltered}
        onRetry={() => void creditNotes.refetch()}
        onClearFilters={clearFilters}
        emptyTitle="No credit memos yet"
        emptyDescription="Credit memos refund or adjust an invoice after it has been issued."
      >
        <CreditNoteGrid
          creditNotes={rows}
          total={creditNotes.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          billingEntities={entityOptions ? (entities.data ?? []) : undefined}
          {...(onCreate ? { onCreate } : {})}
          {...(onCreditNoteClick ? { onCreditNoteClick } : {})}
          onClearFilters={clearFilters}
        />
      </ListState>
    </PageBody>
  )
}
