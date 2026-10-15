import { useState } from 'react'
import { type CostSheet, type CostSheetQuery } from '@fp/domain'
import { ApiError, useCostSheets, useDeleteCostSheet, serverReason } from '@fp/query'
import { CostSheetGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface CostSheetListPageProps {
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  onOpenCostSheet: (costSheet: CostSheet) => void
  onCreateCostSheet: () => void
  onEditCostSheet: (costSheet: CostSheet) => void
}

/**
 * The cost sheet surface: a list, inline rename in the name cell, and a
 * confirmed delete. Create and edit are full pages (`CostSheetFormPage`).
 *
 * The list stays URL-driven; the pending delete is the only local state.
 */
export function CostSheetListPage({
  query,
  onQueryChange,
  onOpenCostSheet,
  onCreateCostSheet,
  onEditCostSheet,
}: CostSheetListPageProps) {
  const costSheets = useCostSheets(query)
  const remove = useDeleteCostSheet()

  const [deleting, setDeleting] = useState<CostSheet | null>(null)

  const failure = toListFailure(costSheets.error, 'cost sheets')
  const rows = costSheets.data?.costSheets ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={costSheets.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (costSheets.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={costSheets.isFetching && !costSheets.isPending}
          isProvisional={costSheets.isPlaceholderData}
          isRetrying={costSheets.isFetching && costSheets.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void costSheets.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateCostSheet}>New cost sheet</Button>}
          emptyTitle="No cost sheets yet"
          emptyDescription="Cost sheets record what usage costs you, so margin can be measured against what you charge. Create the first to start."
        >
          <CostSheetGrid
            costSheets={rows}
            total={costSheets.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCostSheetClick={onOpenCostSheet}
            onCreate={onCreateCostSheet}
            onEdit={onEditCostSheet}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete ${deleting?.name ?? 'cost sheet'}?`}
        description="The cost sheet is removed. This cannot be undone."
        confirmLabel="Delete cost sheet"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: closeDelete })
        }}
        isPending={remove.isPending}
        destructive
        error={toSubmitError(remove.error)}
      />
    </>
  )
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change cost sheets here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the cost sheet. Try again.'
    }
  }
  return 'Could not save the cost sheet. Try again.'
}
