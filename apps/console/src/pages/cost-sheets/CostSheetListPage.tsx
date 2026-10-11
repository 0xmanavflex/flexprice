import { useState } from 'react'
import { type CostSheet, type CostSheetQuery } from '@fp/domain'
import { ApiError, useCostSheets, useDeleteCostSheet } from '@fp/query'
import { CostSheetGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { SheetIcon } from '@fp/ui/icons'

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

  const failure = toFailure(costSheets.error)
  const rows = costSheets.data?.costSheets ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

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
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void costSheets.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateCostSheet}>New cost sheet</Button>}
          emptyIcon={<SheetIcon aria-hidden />}
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

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to cost sheets here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading cost sheets.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading cost sheets.', canRetry: true }
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change cost sheets here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the cost sheet. Try again.'
    }
  }
  return 'Could not save the cost sheet. Try again.'
}
