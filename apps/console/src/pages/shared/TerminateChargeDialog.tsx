import { useState } from 'react'
import { type Charge } from '@fp/domain'
import { useTerminatePrice } from '@fp/query'
import { ConfirmDialog, DateInput } from '@fp/ui/compositions'

export interface TerminateChargeDialogProps {
  /** The charge to end; null keeps the dialog closed. */
  charge: Charge | null
  /** What the charge belongs to, for the wording ("plan", "add-on"). */
  noun: string
  onClose: () => void
}

const today = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Ending a charge, now or on a chosen day. A later day keeps it billing until
 * then; past invoices that referenced it are unaffected either way.
 */
export function TerminateChargeDialog({ charge, noun, onClose }: TerminateChargeDialogProps) {
  const terminate = useTerminatePrice()
  const [endDate, setEndDate] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const close = () => {
    setEndDate('')
    setProblem(null)
    terminate.reset()
    onClose()
  }

  return (
    <ConfirmDialog
      open={charge !== null}
      onOpenChange={(open) => (open ? undefined : close())}
      title="Terminate this charge?"
      description={
        <span className="flex flex-col gap-3 pt-2 text-left">
          <span>
            “{charge?.displayName || charge?.meterName || 'This charge'}” stops billing on this{' '}
            {noun}. Past invoices that referenced it are unaffected.
          </span>
          <label htmlFor="terminate-end" className="flex flex-col gap-1.5 text-sm">
            End on
            <DateInput
              id="terminate-end"
              value={endDate}
              onValueChange={(value) => {
                setEndDate(value)
                setProblem(null)
              }}
              placeholder="Now"
            />
          </label>
        </span>
      }
      confirmLabel="Terminate charge"
      destructive
      isPending={terminate.isPending}
      error={problem ?? (terminate.isError ? 'Could not terminate the charge. Try again.' : null)}
      onConfirm={() => {
        if (!charge) return
        if (endDate && endDate < today()) {
          setProblem('The end date cannot be in the past.')
          return
        }
        terminate.mutate(
          { id: charge.id, ...(endDate ? { endDate: new Date(`${endDate}T00:00:00Z`) } : {}) },
          { onSuccess: close },
        )
      }}
    />
  )
}
