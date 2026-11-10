import {
  ApiError,
  useBillingEntities,
  useBillingEntityStatus,
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
  serverReason,
} from '@fp/query'
import {
  BillingEntityMode,
  customerToEdit,
  toCustomerFieldErrors,
  type CreateCustomer,
} from '@fp/domain'
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
  const entitiesOn = useBillingEntityStatus().data === BillingEntityMode.Enabled
  const entities = useBillingEntities({ enabled: props.mode === 'create' })

  if (props.mode === 'create') {
    return (
      <CustomerForm
        mode="create"
        trail={[{ label: 'Customers', onClick: onCancel }, { label: 'Create customer' }]}
        billingEntities={entitiesOn ? entities.data : undefined}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); a field it names is also marked.
        submitError={null}
        fieldErrors={fieldErrorsOf(create.error)}
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
      fieldErrors={fieldErrorsOf(update.error)}
      onSubmit={(draft: CreateCustomer) =>
        update.mutate({ id: customer.id, draft }, { onSuccess: () => props.onDone(customer.id) })
      }
    />
  )
}

/** A save failure, as a sentence the form can show inline. */
/** The fields the API refused, each with a reason the form shows under it. */
function fieldErrorsOf(error: unknown) {
  return error instanceof ApiError ? toCustomerFieldErrors(error.details) : null
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        // "Request validation failed" says nothing; the fields themselves say what.
        if (fieldErrorsOf(error)) return 'Some details need fixing. Check the highlighted fields.'
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
