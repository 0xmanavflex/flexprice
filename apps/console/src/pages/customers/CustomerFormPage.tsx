import { ApiError, useCreateCustomer, useCustomer, useUpdateCustomer } from '@fp/query'
import { customerToEdit, type CreateCustomer } from '@fp/domain'
import { CustomerForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'

export type CustomerFormPageProps = {
  step?: string
  onStepChange: (id: string) => void
  onCancel: () => void
} & (
  | { mode: 'create'; onDone: (customerId: string) => void }
  | { mode: 'edit'; customerId: string; onDone: (customerId: string) => void }
)

/**
 * Create or edit a customer on its own page.
 *
 * Same stepped form both ways (`CustomerForm`), the step in the URL. Create ends
 * on the new customer's detail page; edit returns to the one it came from. The
 * data layer is the hooks the dialog used — nothing about saving changed.
 */
export function CustomerFormPage(props: CustomerFormPageProps) {
  const { step, onStepChange, onCancel } = props
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const existing = useCustomer(props.mode === 'edit' ? props.customerId : '')
  const stepProps = { ...(step ? { step } : {}), onStepChange, onCancel }

  if (props.mode === 'create') {
    return (
      <CustomerForm
        mode="create"
        trail={[{ label: 'Customers', onClick: onCancel }, { label: 'Create customer' }]}
        {...stepProps}
        isSubmitting={create.isPending}
        submitError={toSubmitError(create.error)}
        onSubmit={(draft: CreateCustomer) =>
          create.mutate(draft, {
            onSuccess: (created) => props.onDone((created as { id?: string }).id ?? ''),
          })
        }
      />
    )
  }

  if (existing.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  if (existing.error || !existing.data) {
    return (
      <PageBody>
        <AppFailure
          title="This customer could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const customer = existing.data
  return (
    <CustomerForm
      mode="edit"
      customerName={customer.name}
      defaultValue={customerToEdit(customer)}
      trail={[
        { label: 'Customers', onClick: onCancel },
        { label: customer.name, onClick: () => props.onDone(customer.id) },
        { label: 'Edit' },
      ]}
      {...stepProps}
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
        return 'You do not have permission to change customers here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the customer. Try again.'
    }
  }
  return 'Could not save the customer. Try again.'
}
