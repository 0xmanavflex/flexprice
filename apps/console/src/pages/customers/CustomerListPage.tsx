import { useState } from 'react'
import { type CreateCustomer, type Customer, type CustomerQuery, customerToEdit } from '@fp/domain'
import {
  ApiError,
  useCreateCustomer,
  useCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@fp/query'
import { CustomerEditorDialog, CustomerGrid } from '@fp/ui/flexprice'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { UsersIcon } from 'lucide-react'

export interface CustomerListPageProps {
  query: CustomerQuery
  onQueryChange: (query: CustomerQuery) => void
  /** Open a customer's detail page. */
  onOpenCustomer?: (customerId: string) => void
}

/** Which record the dialog is editing — a new customer, or an existing one. */
type Editing = { mode: 'create' } | { mode: 'edit'; customer: Customer } | null

/**
 * The customer surface: a list, a dialog to create or edit a customer, inline
 * rename in the name cell, and a confirmed delete.
 *
 * The list row omits the address, so editing loads the full customer before
 * the dialog opens, rather than seeding it with blanks that a save would send.
 * The list stays URL-driven; the dialog and the pending delete are the only
 * local state.
 */
export function CustomerListPage({ query, onQueryChange, onOpenCustomer }: CustomerListPageProps) {
  const customers = useCustomers(query)
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const remove = useDeleteCustomer()

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)

  const detail = useCustomer(editing?.mode === 'edit' ? editing.customer.id : '')

  const failure = toFailure(customers.error)
  const rows = customers.data?.customers ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const active = editing?.mode === 'create' ? create : update

  const close = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  const submit = (draft: CreateCustomer) => {
    if (editing?.mode === 'create') {
      create.mutate(draft, { onSuccess: close })
    } else if (editing?.mode === 'edit') {
      update.mutate({ id: editing.customer.id, draft }, { onSuccess: close })
    }
  }

  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const dialogOpen = editing?.mode === 'create' || (editing?.mode === 'edit' && !!detail.data)

  return (
    <>
      <PageBody>
        <ListState
          isLoading={customers.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void customers.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => setEditing({ mode: 'create' })}>New customer</Button>}
          emptyIcon={<UsersIcon aria-hidden />}
          emptyTitle="No customers yet"
          emptyDescription="Customers are who you bill. Each carries subscriptions, invoices and a payment history."
        >
          <CustomerGrid
            customers={rows}
            total={customers.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            {...(onOpenCustomer ? { onCustomerClick: (customer) => onOpenCustomer(customer.id) } : {})}
            onRename={(customer, name) =>
              update
                .mutateAsync({ id: customer.id, draft: { externalId: customer.externalId, name } })
                .then(() => undefined, () => undefined)
            }
            onCreate={() => setEditing({ mode: 'create' })}
            onEdit={(customer) => setEditing({ mode: 'edit', customer })}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <CustomerEditorDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode={editing?.mode ?? 'create'}
        {...(editing?.mode === 'edit' && detail.data
          ? { defaultValue: customerToEdit(detail.data) }
          : {})}
        onSubmit={submit}
        isSubmitting={active.isPending}
        submitError={toSubmitError(active.error)}
      />

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

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to customers here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading customers.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading customers.', canRetry: true }
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change customers here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the customer. Try again.'
    }
  }
  return 'Could not save the customer. Try again.'
}
