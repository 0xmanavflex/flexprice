import { useState } from 'react'
import { type TaxRate, type TaxRateQuery } from '@fp/domain'
import { ApiError, useDeleteTaxRate, useTaxRates, serverReason } from '@fp/query'
import { TaxRateGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

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
 * cannot change the value or scope: invoices carry them.
 */
export function TaxListPage({
  query,
  onQueryChange,
  onCreateTaxRate,
  onEditTaxRate,
}: TaxListPageProps) {
  const taxRates = useTaxRates(query)
  const remove = useDeleteTaxRate()

  const [deleting, setDeleting] = useState<TaxRate | null>(null)

  const failure = toListFailure(taxRates.error, 'tax rates')
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
          isEmpty={rows.length === 0 && (taxRates.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={taxRates.isFetching && !taxRates.isPending}
          isProvisional={taxRates.isPlaceholderData}
          isRetrying={taxRates.isFetching && taxRates.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void taxRates.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateTaxRate}>Add tax</Button>}
          emptyTitle="No taxes set up yet"
          emptyDescription="Taxes are the percentages added on top of an invoice, like VAT or GST. Add a tax, then attach it to the customers, plans or charges it applies to."
        >
          <TaxRateGrid
            taxRates={rows}
            total={taxRates.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
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

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change tax rates here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the tax rate. Try again.'
    }
  }
  return 'Could not save the tax rate. Try again.'
}
