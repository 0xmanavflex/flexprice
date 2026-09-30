import { useState } from 'react'
import { type CostSheet, type CostSheetQuery, type CreateCostSheet, costSheetToEdit } from '@fp/domain'
import {
  ApiError,
  useCostSheets,
  useCreateCostSheet,
  useDeleteCostSheet,
  useUpdateCostSheet,
} from '@fp/query'
import { CostSheetEditorDialog, CostSheetGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { SheetIcon } from 'lucide-react'

export interface CostSheetListPageProps {
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  onOpenCostSheet: (costSheet: CostSheet) => void
}

/** Which record the dialog is editing — a new one, or an existing cost sheet. */
type Editing = { mode: 'create' } | { mode: 'edit'; costSheet: CostSheet } | null

/**
 * The cost sheet surface: a list, a dialog to create or edit one, inline rename
 * in the name cell, and a confirmed delete.
 *
 * The list stays URL-driven; the dialog and the pending delete are the only
 * local state, because a half-typed cost sheet is not worth a URL.
 */
export function CostSheetListPage({
  query,
  onQueryChange,
  onOpenCostSheet,
}: CostSheetListPageProps) {
  const costSheets = useCostSheets(query)
  const create = useCreateCostSheet()
  const update = useUpdateCostSheet()
  const remove = useDeleteCostSheet()

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<CostSheet | null>(null)

  const failure = toFailure(costSheets.error)
  const rows = costSheets.data?.costSheets ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const active = editing?.mode === 'create' ? create : update

  const close = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  const submit = (draft: CreateCostSheet) => {
    if (editing?.mode === 'create') {
      create.mutate(draft, { onSuccess: close })
    } else if (editing?.mode === 'edit') {
      update.mutate({ id: editing.costSheet.id, draft }, { onSuccess: close })
    }
  }

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
          createAction={<Button onClick={() => setEditing({ mode: 'create' })}>New cost sheet</Button>}
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
            onRename={(costSheet, name) =>
              update
                .mutateAsync({ id: costSheet.id, draft: { name } })
                .then(() => undefined, () => undefined)
            }
            onCreate={() => setEditing({ mode: 'create' })}
            onEdit={(costSheet) => setEditing({ mode: 'edit', costSheet })}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <CostSheetEditorDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode={editing?.mode ?? 'create'}
        {...(editing?.mode === 'edit' ? { defaultValue: costSheetToEdit(editing.costSheet) } : {})}
        onSubmit={submit}
        isSubmitting={active.isPending}
        submitError={toSubmitError(active.error)}
      />

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
