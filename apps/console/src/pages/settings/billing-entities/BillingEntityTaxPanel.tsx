import { useMemo } from 'react'
import { DEFAULT_TAX_RATE_QUERY } from '@fp/domain'
import {
  ApiError,
  serverReason,
  useCreateTaxAssociation,
  useCreateTaxRate,
  useDeleteTaxAssociation,
  useEntityTaxAssociations,
  useTaxRates,
  useUpdateTaxAssociation,
} from '@fp/query'
import { TaxAssociationSection, toast } from '@fp/ui/pages'

const COPY = {
  failedDetail: "The rest of this entity's record still works.",
  emptyDescription: 'Add a rate to have it applied to new customers of this entity.',
  removeDescription: 'will no longer be added to new customers of this entity.',
}

/** Wires a billing entity's default taxes: reads them and runs add, edit and remove. */
export function BillingEntityTaxPanel({ entityId }: { entityId: string }) {
  const associations = useEntityTaxAssociations('billing_entity', entityId)
  const rates = useTaxRates({ ...DEFAULT_TAX_RATE_QUERY, pageSize: 100, statuses: ['published'] })
  const create = useCreateTaxAssociation(entityId, 'billing_entity')
  const createRate = useCreateTaxRate()
  const update = useUpdateTaxAssociation()
  const remove = useDeleteTaxAssociation()

  const options = useMemo(
    () =>
      (rates.data?.taxRates ?? [])
        .filter((rate) => rate.code !== '')
        .map((rate) => ({
          code: rate.code,
          label: `${rate.name}${rate.percentageValue ? ` (${rate.percentageValue}%)` : ''}`,
        })),
    [rates.data],
  )

  const error =
    failure(create.error, 'add the tax rate') ??
    failure(update.error, 'save the tax rate') ??
    failure(remove.error, 'remove the tax rate')

  return (
    <TaxAssociationSection
      description="Added automatically to new customers of this entity. Existing customers keep their taxes."
      subject="billing entity"
      copy={COPY}
      alwaysAutoApply
      associations={associations.data ?? []}
      taxRates={options}
      isLoading={associations.isPending}
      failed={associations.error !== null}
      onRetry={() => void associations.refetch()}
      onCreateTaxRate={async (draft) => {
        await createRate.mutateAsync(draft)
        return {
          code: draft.code,
          label: `${draft.name}${draft.percentageValue ? ` (${draft.percentageValue}%)` : ''}`,
        }
      }}
      onCreate={(draft) =>
        create.mutateAsync({ ...draft, autoApply: true }).then((result) => {
          toast.success('Tax rate added')
          return result
        })
      }
      onUpdate={(id, draft) =>
        update.mutateAsync({ id, draft: { ...draft, autoApply: true } }).then((result) => {
          toast.success('Tax rate updated')
          return result
        })
      }
      onRemove={(id) =>
        remove.mutateAsync(id).then((result) => {
          toast.success('Tax rate removed')
          return result
        })
      }
      error={error}
      onResetError={() => {
        create.reset()
        update.reset()
        remove.reset()
      }}
    />
  )
}

function failure(error: unknown, action: string): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return serverReason(error) ?? `You do not have permission to ${action}.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${action}. Try again.`
}
