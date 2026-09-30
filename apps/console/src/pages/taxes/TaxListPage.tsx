import { useState } from 'react'
import {
  type CreateTaxRate,
  type EditTaxRate,
  type TaxRate,
  type TaxRateQuery,
  taxRateToEdit,
} from '@fp/domain'
import {
  ApiError,
  useCreateTaxRate,
  useDeleteTaxRate,
  useTaxRates,
  useUpdateTaxRate,
} from '@fp/query'
import { TaxRateEditorDialog, TaxRateGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { PercentIcon } from 'lucide-react'

export interface TaxListPageProps {
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
}

/** Which record the dialog is editing — a new rate, or an existing one. */
type Editing = { mode: 'create' } | { mode: 'edit'; taxRate: TaxRate } | null

/**
 * The tax rate surface: a list, a dialog to create or edit a rate, inline
 * rename in the name cell, and a confirmed delete.
 *
 * The list stays URL-driven; the dialog and the pending delete are the only
 * local state. An edit cannot change the value or scope — invoices carry them.
 */
export function TaxListPage({ query, onQueryChange }: TaxListPageProps) {
  const taxRates = useTaxRates(query)
  const create = useCreateTaxRate()
  const update = useUpdateTaxRate()
  const remove = useDeleteTaxRate()

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<TaxRate | null>(null)

  const failure = toFailure(taxRates.error)
  const rows = taxRates.data?.taxRates ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const active = editing?.mode === 'create' ? create : update

  const close = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const submitCreate = (draft: CreateTaxRate) => create.mutate(draft, { onSuccess: close })
  const submitEdit = (draft: EditTaxRate) => {
    if (editing?.mode === 'edit') {
      update.mutate({ id: editing.taxRate.id, draft }, { onSuccess: close })
    }
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={taxRates.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void taxRates.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => setEditing({ mode: 'create' })}>New tax rate</Button>}
          emptyIcon={<PercentIcon aria-hidden />}
          emptyTitle="No tax rates yet"
          emptyDescription="Tax rates decide what is added to an invoice, and where each rate applies. Create the first to start."
        >
          <TaxRateGrid
            taxRates={rows}
            total={taxRates.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onRename={(taxRate, name) =>
              update
                .mutateAsync({ id: taxRate.id, draft: { ...taxRateToEdit(taxRate), name } })
                .then(() => undefined, () => undefined)
            }
            onCreate={() => setEditing({ mode: 'create' })}
            onEdit={(taxRate) => setEditing({ mode: 'edit', taxRate })}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      {editing?.mode === 'edit' ? (
        <TaxRateEditorDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) close()
          }}
          defaultValue={taxRateToEdit(editing.taxRate)}
          onSubmit={submitEdit}
          isSubmitting={update.isPending}
          submitError={toSubmitError(update.error)}
        />
      ) : (
        <TaxRateEditorDialog
          mode="create"
          open={editing?.mode === 'create'}
          onOpenChange={(open) => {
            if (!open) close()
          }}
          onSubmit={submitCreate}
          isSubmitting={active.isPending}
          submitError={toSubmitError(active.error)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete ${deleting?.name ?? 'tax rate'}?`}
        description="The rate is removed. Invoices that already carry it keep it. This cannot be undone."
        confirmLabel="Delete tax rate"
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
        return { message: 'You do not have access to tax rates here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading tax rates.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading tax rates.', canRetry: true }
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change tax rates here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the tax rate. Try again.'
    }
  }
  return 'Could not save the tax rate. Try again.'
}
