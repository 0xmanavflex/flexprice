import { useCreateBillingEntity } from '@fp/query'
import { BillingEntityForm } from '@fp/ui/pages'
import { RequireBillingEntities } from './RequireBillingEntities'
import { useEntityInvoicePreview } from './useEntityInvoicePreview'

export interface BillingEntityFormPageProps {
  step?: string
  onStepChange: (id: string) => void
  onCancel: () => void
  onDone: (entityId: string) => void
}

/** Create a billing entity on its own page; ends on the new entity's detail page. */
export function BillingEntityFormPage({
  step,
  onStepChange,
  onCancel,
  onDone,
}: BillingEntityFormPageProps) {
  const create = useCreateBillingEntity()
  const preview = useEntityInvoicePreview()

  return (
    <RequireBillingEntities>
      <BillingEntityForm
        mode="create"
        {...(step ? { step } : {})}
        onStepChange={onStepChange}
        trail={[{ label: 'Billing entities', onClick: onCancel }, { label: 'New entity' }]}
        preview={preview}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal (a taken prefix, say) is a toast (MutationToasts).
        onSubmit={(draft) => create.mutate(draft, { onSuccess: (created) => onDone(created.id) })}
      />
    </RequireBillingEntities>
  )
}
