import { useMemo } from 'react'
import { DEFAULT_TAX_RATE_QUERY } from '@fp/domain'
import {
  ApiError,
  useCreateTaxAssociation,
  useCreateTaxRate,
  useCustomerTaxAssociations,
  useDeleteTaxAssociation,
  useTaxRates,
  useUpdateTaxAssociation,
  serverReason,
} from '@fp/query'
import { CustomerTaxSection, toast } from '@fp/ui/pages'

export interface CustomerTaxPanelProps {
  customerId: string
}

/** Wires a customer's tax associations: reads them and runs add, edit and remove. */
export function CustomerTaxPanel({ customerId }: CustomerTaxPanelProps) {
  const associations = useCustomerTaxAssociations(customerId)
  const rates = useTaxRates({ ...DEFAULT_TAX_RATE_QUERY, pageSize: 100, statuses: ['published'] })
  const create = useCreateTaxAssociation(customerId)
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
    <CustomerTaxSection
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
        create.mutateAsync(draft).then((result) => {
          toast.success('Tax rate added')
          return result
        })
      }
      onUpdate={(id, draft) =>
        update.mutateAsync({ id, draft }).then((result) => {
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
