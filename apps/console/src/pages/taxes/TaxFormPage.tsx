import { taxRateToEdit, type CreateTaxRate, type EditTaxRate } from '@fp/domain'
import { ApiError, useCreateTaxRate, useTaxRate, useUpdateTaxRate, serverReason } from '@fp/query'
import { TaxRateCreateForm, TaxRateEditForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'

export type TaxFormPageProps = { onCancel: () => void; onDone: () => void } & (
  { mode: 'create' } | { mode: 'edit'; taxRateId: string }
)

/**
 * Create or edit a tax rate on its own page: `/taxes/new` and `/taxes/$taxRateId/edit`.
 *
 * There is no detail page, so both return to the list. Edit is prepopulated and
 * limited to what the API lets change (name, code, description, status). The
 * edit reads the rate by id (`GET /taxes/rates/{id}`), so a rate past the first
 * page of the list can be edited too.
 */
export function TaxFormPage(props: TaxFormPageProps) {
  const { onCancel, onDone } = props
  const create = useCreateTaxRate()
  const update = useUpdateTaxRate()
  const rates = useTaxRate(props.mode === 'edit' ? props.taxRateId : '')

  if (props.mode === 'create') {
    return (
      <TaxRateCreateForm
        trail={[{ label: 'Tax rates', onClick: onCancel }, { label: 'Create tax rate' }]}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateTaxRate) => create.mutate(draft, { onSuccess: onDone })}
      />
    )
  }

  if (rates.isLoading) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  const taxRate = rates.data
  if (rates.error || !taxRate) {
    return (
      <PageBody>
        <AppFailure
          title={
            rates.error ? 'This tax rate could not be loaded' : 'This tax rate no longer exists'
          }
          detail="Try again, or go back to the list."
          onRetry={rates.error ? () => void rates.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  return (
    <TaxRateEditForm
      trail={[
        { label: 'Tax rates', onClick: onCancel },
        { label: 'Tax rate details' },
        { label: 'Edit' },
      ]}
      defaultValue={taxRateToEdit(taxRate)}
      onCancel={onCancel}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: EditTaxRate) =>
        update.mutate({ id: taxRate.id, draft }, { onSuccess: onDone })
      }
    />
  )
}

/** A save failure, as a sentence the form can show inline. */
export function toSubmitError(error: unknown): string | null {
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
