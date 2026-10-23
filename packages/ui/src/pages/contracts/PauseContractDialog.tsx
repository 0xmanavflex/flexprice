import { useState } from 'react'
import type { PauseSubscription, ResumeSubscription } from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { provenance } from '@ui/provenance'

export const PauseContractDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/FormDialog',
    'compositions/detail/DetailKit',
    'ui/switch',
    'ui/textarea',
  ],
  note: "V1's Pause / Resume subscription dialogs: a proration choice, and a reason when pausing.",
})

export type PauseContractDialogProps =
  | {
      mode: 'pause'
      open: boolean
      onOpenChange: (open: boolean) => void
      onConfirm: (draft: PauseSubscription) => Promise<unknown>
    }
  | {
      mode: 'resume'
      open: boolean
      onOpenChange: (open: boolean) => void
      onConfirm: (draft: ResumeSubscription) => Promise<unknown>
    }

/**
 * Pause a running contract, or resume a paused one.
 *
 * The same two inputs V1 asks for: whether to prorate the current period, and
 * (pausing only) an optional reason kept on the contract.
 */
export function PauseContractDialog(props: PauseContractDialogProps) {
  const { mode, open, onOpenChange } = props
  const [prorate, setProrate] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setProrate(false)
    setReason('')
    setError(null)
    onOpenChange(false)
  }

  const submit = () => {
    setPending(true)
    setError(null)
    const request =
      props.mode === 'pause' ? props.onConfirm({ prorate, reason }) : props.onConfirm({ prorate })
    request
      .then(close)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'The change could not be saved.'),
      )
      .finally(() => setPending(false))
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={mode === 'pause' ? 'Pause contract' : 'Resume contract'}
      description={
        mode === 'pause'
          ? 'Billing stops until the contract is resumed.'
          : 'Billing starts again from today.'
      }
      size="sm"
      isPending={pending}
    >
      <Composer
        submitLabel={mode === 'pause' ? 'Pause contract' : 'Resume contract'}
        onSubmit={submit}
        onCancel={close}
        submitting={pending}
      >
        <label className="flex items-center justify-between gap-3 text-sm">
          {mode === 'pause'
            ? 'Credit the unused part of this period'
            : 'Charge for the rest of this period'}
          <Switch checked={prorate} disabled={pending} onCheckedChange={setProrate} />
        </label>
        {mode === 'pause' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pause-contract-reason" className="text-sm">
              Reason (optional)
            </label>
            <Textarea
              id="pause-contract-reason"
              value={reason}
              disabled={pending}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}
