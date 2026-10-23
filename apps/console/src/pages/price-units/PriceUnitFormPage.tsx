import { type CreatePriceUnit } from '@fp/domain'
import { ApiError, useCreatePriceUnit, serverReason } from '@fp/query'
import { PriceUnitForm } from '@fp/ui/pages'

export interface PriceUnitFormPageProps {
  onCancel: () => void
  /** Called with the new unit's id, or `''` when the response did not name one. */
  onDone: (priceUnitId: string) => void
}

/**
 * Create a price unit on its own page, `/price-units/new`.
 *
 * Create only: the API lets just the name change afterwards, which is edited in
 * place on the detail page. Success lands on the new unit's detail page.
 */
export function PriceUnitFormPage({ onCancel, onDone }: PriceUnitFormPageProps) {
  const create = useCreatePriceUnit()

  return (
    <PriceUnitForm
      trail={[{ label: 'Price Units', onClick: onCancel }, { label: 'Create price unit' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      // The API's refusal is a toast (MutationToasts); validation stays in the form.
      submitError={null}
      onSubmit={(draft: CreatePriceUnit) =>
        create.mutate(draft, {
          onSuccess: (created) => onDone((created as { id?: string }).id ?? ''),
        })
      }
    />
  )
}

/** A save failure, as a sentence the form can show inline. */
export function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // A duplicate code is the common one, so the server's own message wins.
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change price units here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the price unit. Try again.'
    }
  }
  return 'Could not save the price unit. Try again.'
}
