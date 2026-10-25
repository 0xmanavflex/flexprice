import { useState } from 'react'
import {
  MANUAL_PAYMENT_STATUS_EFFECT,
  type Money,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  PaymentStatus as Status,
  formatMoney,
} from '@fp/domain'
import { Field } from '@ui/components/primitives/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Label } from '@ui/components/primitives/label'
import { ChoiceCards, Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { provenance } from '@ui/provenance'
import { Pill, type PillTone } from '../../shared/cells'

export const PaymentStatusDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/FormDialog', 'compositions/detail-kit', 'ui/input-group'],
  note: "Manual payment status for an invoice: current state, the backend's allowed moves, and a partial amount for pending.",
})

export interface PaymentStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The invoice's payment status now; null when the API sent none. */
  current: PaymentStatus | null
  /** The statuses it may move to: `manualPaymentStatusChoices`. */
  choices: readonly PaymentStatus[]
  amountDue: Money
  /** What has been paid so far, as the API reports it. */
  amountPaid: Money
  amountRemaining: Money
  isPending?: boolean
  /** A refusal from the API, already a sentence. */
  error?: string | null
  onSubmit: (change: { status: PaymentStatus; amount?: string }) => void
}

const TONE: Partial<Record<PaymentStatus, PillTone>> = {
  [Status.Succeeded]: 'success',
  [Status.Overpaid]: 'success',
  [Status.Failed]: 'danger',
  [Status.Pending]: 'warning',
}

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Set an invoice's payment status by hand, for money that moved outside
 * Flexprice.
 *
 * Opens on what the invoice says now: its status and its amounts: and offers
 * only the moves the API accepts from there. Pending can carry the amount paid
 * so far, which is how a partial payment is recorded; the other statuses set
 * the balance themselves (paid in full, or owed in full).
 */
export function PaymentStatusDialog({
  open,
  onOpenChange,
  current,
  choices,
  amountDue,
  amountPaid,
  amountRemaining,
  isPending = false,
  error = null,
  onSubmit,
}: PaymentStatusDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Update payment status"
      isPending={isPending}
    >
      <Body
        current={current}
        choices={choices}
        amountDue={amountDue}
        amountPaid={amountPaid}
        amountRemaining={amountRemaining}
        isPending={isPending}
        error={error}
        onCancel={() => onOpenChange(false)}
        onSubmit={onSubmit}
      />
    </FormDialog>
  )
}

function Body({
  current,
  choices,
  amountDue,
  amountPaid,
  amountRemaining,
  isPending,
  error,
  onCancel,
  onSubmit,
}: Omit<PaymentStatusDialogProps, 'open' | 'onOpenChange' | 'isPending'> & {
  isPending: boolean
  onCancel: () => void
}) {
  // Starts on the first real change from where the invoice is.
  const [status, setStatus] = useState<PaymentStatus | undefined>(
    choices.find((choice) => choice !== current) ?? choices[0],
  )
  const [amount, setAmount] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const currency = amountDue.currency

  return (
    <Composer
      submitLabel={isPending ? 'Updating…' : 'Update status'}
      onCancel={onCancel}
      submitting={isPending}
      disabled={!status}
      onSubmit={() => {
        if (!status) return
        const typed = amount.trim()
        if (status === Status.Pending && typed) {
          if (!DECIMAL.test(typed)) return setProblem('Enter the amount paid as a number')
          if (Number(typed) > Number(amountDue.amount)) {
            return setProblem(`The amount paid cannot be more than ${formatMoney(amountDue)}`)
          }
        }
        setProblem(null)
        onSubmit(status === Status.Pending && typed ? { status, amount: typed } : { status })
      }}
    >
      <p className="text-muted-foreground text-sm">
        For money that moved outside Flexprice. The invoice and its balance follow.
      </p>

      <dl className="bg-muted/40 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Current status</dt>
          <dd>
            {current ? (
              <Pill tone={TONE[current] ?? 'neutral'}>{PAYMENT_STATUS_LABEL[current]}</Pill>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </dd>
        </div>
        <Amount label="Amount due" value={amountDue} />
        <Amount label="Paid" value={amountPaid} />
        <Amount label="Remaining" value={amountRemaining} />
      </dl>

      {status ? (
        <ChoiceCards
          label="New payment status"
          value={status}
          onChange={(next) => {
            setStatus(next)
            setProblem(null)
          }}
          choices={choices.map((choice) => ({
            value: choice,
            title:
              choice === current
                ? `${PAYMENT_STATUS_LABEL[choice]} (current)`
                : PAYMENT_STATUS_LABEL[choice],
            description: MANUAL_PAYMENT_STATUS_EFFECT[choice] ?? '',
          }))}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          This invoice&apos;s payment status cannot be changed by hand.
        </p>
      )}

      {status === Status.Pending ? (
        <Field className="max-w-xs">
          <Label htmlFor="payment-status-amount">Amount paid so far</Label>
          <InputGroup className="h-9">
            <InputGroupInput
              id="payment-status-amount"
              inputMode="decimal"
              placeholder={amountPaid.amount}
              value={amount}
              disabled={isPending}
              aria-invalid={problem ? true : undefined}
              onChange={(event) => {
                setAmount(event.target.value)
                setProblem(null)
              }}
            />
            <InputGroupAddon align="inline-end">{currency}</InputGroupAddon>
          </InputGroup>
          <p className="text-muted-foreground text-xs">
            Optional. Leave blank to keep {formatMoney(amountPaid)}.
          </p>
        </Field>
      ) : null}

      {problem || error ? (
        <p role="alert" className="text-destructive text-sm">
          {problem ?? error}
        </p>
      ) : null}
    </Composer>
  )
}

function Amount({ label, value }: { label: string; value: Money }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{formatMoney(value)}</dd>
    </div>
  )
}
