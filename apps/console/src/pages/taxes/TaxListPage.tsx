import { useState } from 'react'
import { type TaxRate, type TaxRateQuery, taxRateToEdit } from '@fp/domain'
import { ApiError, useDeleteTaxRate, useTaxRates, useUpdateTaxRate } from '@fp/query'
import { TaxRateGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { PercentIcon } from 'lucide-react'

export interface TaxListPageProps {
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
  onCreateTaxRate: () => void
  onEditTaxRate: (taxRate: TaxRate) => void
}

/**
 * The tax rate surface: a list, full pages to create or edit a rate
 * (`/taxes/new`, `/taxes/$taxRateId/edit`), inline rename in the name cell, and
 * a confirmed delete.
 *
 * The list stays URL-driven; the pending delete is the only local state. An edit
 * cannot change the value or scope — invoices carry them.
 */
export function TaxListPage({
  query,
  onQueryChange,
  onCreateTaxRate,
  onEditTaxRate,
}: TaxListPageProps) {
  const taxRates = useTaxRates(query)
  const update = useUpdateTaxRate()
  const remove = useDeleteTaxRate()

  const [deleting, setDeleting] = useState<TaxRate | null>(null)

  const failure = toFailure(taxRates.error)
  const rows = taxRates.data?.taxRates ?? []
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
          isLoading={taxRates.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void taxRates.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateTaxRate}>New tax rate</Button>}
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
                .then(
                  () => undefined,
                  () => undefined,
                )
            }
            onCreate={onCreateTaxRate}
            onEdit={onEditTaxRate}
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
