import {
  type FxRateOwner,
  ApiError,
  serverReason,
  useCreateFxRate,
  useDeleteFxRate,
  useFxRates,
  useUpdateFxRate,
} from '@fp/query'
import { FxRatesSection, toast } from '@fp/ui/pages'

export interface FxRatesPanelProps {
  owner: FxRateOwner
  /** A contract converts from its own currency. */
  lockedFrom?: string | undefined
  emptyDescription?: string | undefined
  readOnly?: boolean | undefined
}

/**
 * Wires forex rates: the global rate per pair (Settings › Currency), or a
 * customer's or contract's overrides of it. The API's own refusal (no global
 * rate for the pair, an overlapping window) is shown in the dialog.
 */
export function FxRatesPanel({ owner, lockedFrom, emptyDescription, readOnly }: FxRatesPanelProps) {
  const rates = useFxRates(owner)
  const create = useCreateFxRate(owner)
  const update = useUpdateFxRate()
  const remove = useDeleteFxRate()
  const global = owner.scope === 'tenant'
  const noun = global ? 'forex rate' : 'FX override'

  const error =
    failure(create.error, `add the ${noun}`) ??
    failure(update.error, `save the ${noun}`) ??
    failure(remove.error, `delete the ${noun}`)

  return (
    <FxRatesSection
      kind={global ? 'global' : 'override'}
      rates={rates.data ?? []}
      isLoading={rates.isPending}
      failed={rates.error !== null}
      onRetry={() => void rates.refetch()}
      onCreate={(draft) =>
        create.mutateAsync(draft).then((result) => {
          toast.success(global ? 'Forex rate added' : 'FX override added')
          return result
        })
      }
      onUpdate={(id, original, next) =>
        update.mutateAsync({ id, original, next }).then((result) => {
          toast.success(global ? 'Forex rate updated' : 'FX override updated')
          return result
        })
      }
      {...(global
        ? {}
        : {
            onRemove: (id: string) =>
              remove.mutateAsync(id).then((result) => {
                toast.success('FX override deleted')
                return result
              }),
          })}
      error={error}
      onResetError={() => {
        create.reset()
        update.reset()
        remove.reset()
      }}
      lockedFrom={lockedFrom}
      emptyDescription={emptyDescription}
      readOnly={readOnly}
    />
  )
}

function failure(error: unknown, action: string): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return serverReason(error) ?? `You do not have permission to ${action}.`
  if (error instanceof ApiError && (error.kind === 'invalid' || error.fromServer))
    return serverReason(error) ?? 'Check the details and try again.'
  return `Could not ${action}. Try again.`
}
