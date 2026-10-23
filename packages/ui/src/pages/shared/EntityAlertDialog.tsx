import { useState } from 'react'
import type { AlertSettingConfig } from '@fp/domain'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { ErrorState, LoadingRows } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import { ChargeAlertForm } from '../contracts/ChargeAlertForm'

export const EntityAlertDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/FormDialog', 'compositions/States', 'pages/ChargeAlertForm'],
  note: "V1's per-entity Alert Settings: one alert setting watching a contract, feature or wallet, created on first save and updated after.",
})

export interface EntityAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is watched, for the title: "Contract", "Feature", "Wallet". */
  noun: string
  /** The setting is being read; the form waits so it starts on real values. */
  isLoading: boolean
  /** The read failed: shown instead of a form that would create a duplicate. */
  loadFailed: boolean
  onRetry?: (() => void) | undefined
  /** True when nothing watches this entity yet, so saving creates the setting. */
  isNew: boolean
  /** The current thresholds, or the defaults for a new setting. */
  initial: AlertSettingConfig
  /** Resolves when saved; a rejection keeps the dialog open with its message. */
  onSave: (config: AlertSettingConfig) => Promise<unknown>
}

/**
 * Alert settings for one entity, from its More menu.
 *
 * The thresholds are the same as a charge's alerts (`ChargeAlertForm`), with
 * every severity switchable, because a setting created here has none yet. An
 * entity has at most one setting: the caller reads it first, and the dialog
 * either creates it or updates its config.
 */
export function EntityAlertDialog({
  open,
  onOpenChange,
  noun,
  isLoading,
  loadFailed,
  onRetry,
  isNew,
  initial,
  onSave,
}: EntityAlertDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Alert settings"
      description={
        isNew
          ? `Nothing watches this ${noun.toLowerCase()} yet. Set a threshold to start alerting.`
          : `When this ${noun.toLowerCase()} crosses a threshold, an alert is raised.`
      }
      size="sm"
      isPending={pending}
    >
      {isLoading ? (
        <LoadingRows rows={3} columns={2} />
      ) : loadFailed ? (
        <ErrorState title="Alert settings could not be loaded" {...(onRetry ? { onRetry } : {})} />
      ) : (
        <ChargeAlertForm
          initial={initial}
          chooseSeverities
          submitLabel={isNew ? 'Create alert' : 'Save alerts'}
          pending={pending}
          error={error}
          onCancel={close}
          onSubmit={(config) => {
            setPending(true)
            setError(null)
            onSave(config)
              .then(close)
              .catch((cause: unknown) =>
                setError(cause instanceof Error ? cause.message : 'The change could not be saved.'),
              )
              .finally(() => setPending(false))
          }}
        />
      )}
    </FormDialog>
  )
}
