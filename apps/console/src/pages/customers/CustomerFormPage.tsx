import {
  ApiError,
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
  serverReason,
} from '@fp/query'
import { customerToEdit, type CreateCustomer } from '@fp/domain'
import { CustomerForm } from '@fp/ui/pages'
import { detailGate } from '../shared/detailGate'

export type CustomerFormPageProps = {
  onCancel: () => void
} & (
  | { mode: 'create'; onDone: (customerId: string) => void }
  | { mode: 'edit'; customerId: string; onDone: (customerId: string) => void }
)

/**
 * Create or edit a customer on its own page.
 *
 * Same single-page form both ways (`CustomerForm`). Create ends
 * on the new customer's detail page; edit returns to the one it came from. The
 * data layer is the hooks the dialog used: nothing about saving changed.
 */
export function CustomerFormPage(props: CustomerFormPageProps) {
  const { onCancel } = props
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const existing = useCustomer(props.mode === 'edit' ? props.customerId : '')

  if (props.mode === 'create') {
    return (
      <CustomerForm
        mode="create"
        trail={[{ label: 'Customers', onClick: onCancel }, { label: 'Create customer' }]}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateCustomer) =>
          create.mutate(draft, {
            // A created customer with no id cannot be opened: land on the list instead of /customers/.
            onSuccess: (created) => {
              const id = (created as { id?: string }).id
              if (id) props.onDone(id)
              else onCancel()
            },
          })
        }
      />
    )
  }

  if (!existing.data) {
    // A disabled query (empty id) never leaves "pending": show not-found instead of loading forever.
    const gate = props.customerId ? existing : { ...existing, isPending: false, error: null }
    return detailGate(gate, {
      noun: 'this customer',
      listName: 'customers',
      onBack: onCancel,
      ...(props.customerId
        ? { recordPath: `/customers/${encodeURIComponent(props.customerId)}` }
        : {}),
    })
  }

  const customer = existing.data
  return (
    <CustomerForm
      mode="edit"
      customerName={customer.name}
      defaultValue={customerToEdit(customer)}
      trail={[
        { label: 'Customers', onClick: onCancel },
        { label: 'Customer details', onClick: () => props.onDone(customer.id) },
        { label: 'Edit' },
      ]}
      onCancel={onCancel}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: CreateCustomer) =>
        update.mutate({ id: customer.id, draft }, { onSuccess: () => props.onDone(customer.id) })
      }
    />
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
