import { useState } from 'react'
import {
  BILLING_ENTITY_FILTER,
  CUSTOMER_FILTERS,
  type Customer,
  type CustomerQuery,
  DEFAULT_CUSTOMER_QUERY,
  isCustomerQueryFiltered,
  withChoiceFilter,
} from '@fp/domain'
import {
  ApiError,
  useBillingEntities,
  useCustomerContractCounts,
  useCustomers,
  useDeleteCustomer,
  useEntityFilterOptions,
  serverReason,
} from '@fp/query'
import { CustomerGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { useCustomerPortal } from '@/app/customerPortal/useCustomerPortal'
import { toListFailure } from '../shared/listFailure'

export interface CustomerListPageProps {
  query: CustomerQuery
  onQueryChange: (query: CustomerQuery) => void
  /** Open a customer's detail page. */
  onOpenCustomer?: (customerId: string) => void
  /** Go to the full-page create form. */
  onCreateCustomer: () => void
  /** Go to the full-page edit form. */
  onEditCustomer: (customerId: string) => void
}

/**
 * The customer surface: a list, links to the full-page create and edit forms,
 * inline rename in the name cell, and a confirmed delete.
 *
 * The list stays URL-driven; the pending delete is the only local state.
 */
export function CustomerListPage({
  query,
  onQueryChange,
  onOpenCustomer,
  onCreateCustomer,
  onEditCustomer,
}: CustomerListPageProps) {
  const entityOptions = useEntityFilterOptions()
  const entities = useBillingEntities()
  const customers = useCustomers(query, {
    specs: withChoiceFilter(CUSTOMER_FILTERS, BILLING_ENTITY_FILTER, entityOptions),
  })
  const remove = useDeleteCustomer()

  const [deleting, setDeleting] = useState<Customer | null>(null)
  const portal = useCustomerPortal()

  const failure = toListFailure(customers.error, 'customers')
  const rows = customers.data?.customers ?? []
  const contractCounts = useCustomerContractCounts(rows.map((customer) => customer.id))
  const isFiltered = isCustomerQueryFiltered(query)
  // Back to the default view (active customers), not to every status.
  const clearFilters = () =>
    onQueryChange({
      ...query,
      search: '',
      statuses: [],
      filters: DEFAULT_CUSTOMER_QUERY.filters ?? [],
      page: 1,
    })

  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={customers.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (customers.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={customers.isFetching && !customers.isPending}
          isProvisional={customers.isPlaceholderData}
          isRetrying={customers.isFetching && customers.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void customers.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateCustomer}>New customer</Button>}
          emptyTitle="No customers yet"
          emptyDescription="Customers are who you bill. Each carries contracts, invoices and a payment history."
        >
          <CustomerGrid
            customers={rows}
            total={customers.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            {...(contractCounts.data ? { contractCounts: contractCounts.data } : {})}
            billingEntities={entityOptions ? (entities.data ?? []) : undefined}
            {...(onOpenCustomer
              ? { onCustomerClick: (customer) => onOpenCustomer(customer.id) }
              : {})}
            onCreate={onCreateCustomer}
            onEdit={(customer) => onEditCustomer(customer.id)}
            onDelete={setDeleting}
            onOpenPortal={(customer) => void portal.open(customer)}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete ${deleting?.name ?? 'customer'}?`}
        description="The customer is removed from your billing. This cannot be undone."
        confirmLabel="Delete customer"
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
        return serverReason(error) ?? 'You do not have permission to change customers here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the customer. Try again.'
    }
  }
  return 'Could not save the customer. Try again.'
}
