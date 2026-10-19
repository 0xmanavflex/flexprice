import { CircleAlertIcon } from '@ui/icons'
import { useState } from 'react'
import {
  formatMoney,
  validateLineChange,
  type ChangeLineQuantity,
  type LineChangePreview,
  type SubscriptionLine,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@ui/components/primitives/field'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'

export const ContractQuantityDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'ui/input',
    'ui/field',
    '@reui/alert',
  ],
  note: 'Two steps for changing a fixed charge: the quantity (and price, when it can change), then the API preview of what that does before anything is saved.',
})

export interface ContractQuantityDialogProps {
  /** The charge being changed; `null` closes the dialog. */
  line: SubscriptionLine | null
  currency: string
  /** The current billing period; the effective date has to fall inside it. */
  period: { start: Date | null; end: Date | null }
  onClose: () => void
  /** Resolves with what the change would do; a rejection shows its message on the form. */
  onPreview: (line: SubscriptionLine, draft: ChangeLineQuantity) => Promise<LineChangePreview>
  /** Saves the change; a rejection keeps the preview open with the reason. */
  onConfirm: (line: SubscriptionLine, draft: ChangeLineQuantity) => Promise<void> | void
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

const ACTION_LABEL: Record<string, string> = {
  created: 'New line',
  updated: 'Updated',
  ended: 'Ended',
  wallet_credit: 'Credit to wallet',
}

/**
 * Change a fixed charge's quantity, and its price when the price allows it. The
 * preview is not optional: a change prorates the current period, so the dialog
 * always shows the API's answer before it saves.
 */
export function ContractQuantityDialog({
  line,
  currency,
  period,
  onClose,
  onPreview,
  onConfirm,
}: ContractQuantityDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <FormDialog
      open={line !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
      size="sm"
      title="Edit charge"
    >
      {line ? (
        <QuantityFlow
          key={line.id}
          line={line}
          currency={currency}
          period={period}
          onClose={onClose}
          onPreview={onPreview}
          onConfirm={onConfirm}
          onBusy={setBusy}
        />
      ) : null}
    </FormDialog>
  )
}

function QuantityFlow({
  line,
  currency,
  period,
  onClose,
  onPreview,
  onConfirm,
  onBusy,
}: Omit<ContractQuantityDialogProps, 'line'> & {
  line: SubscriptionLine
  onBusy: (busy: boolean) => void
}) {
  const [quantity, setQuantity] = useState(line.quantity)
  const [amount, setAmount] = useState(line.amount.amount)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [touched, setTouched] = useState(false)
  const [preview, setPreview] = useState<LineChangePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft: ChangeLineQuantity = { quantity, amount, effectiveDate }
  const errors = validateLineChange(line, draft, period)
  const invalid = Object.keys(errors).length > 0

  const work = async (task: () => Promise<void> | void) => {
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      await task()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The change could not be completed.')
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }

  if (preview) {
    return (
      <Composer
        submitLabel={busy ? 'Saving…' : 'Confirm change'}
        submitting={busy}
        onCancel={onClose}
        onSubmit={() => void work(() => onConfirm(line, draft))}
      >
        <p className="text-muted-foreground text-sm">
          Review what this does to <strong className="text-foreground">{line.name}</strong> before
          it is saved.
        </p>
        <PreviewSummary preview={preview} />
        <div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2"
            disabled={busy}
            onClick={() => {
              setPreview(null)
              setError(null)
            }}
          >
            Back to edit
          </Button>
        </div>
        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </Composer>
    )
  }

  return (
    <Composer
      submitLabel={busy ? 'Checking…' : 'Preview change'}
      submitting={busy}
      onCancel={onClose}
      onSubmit={() => {
        setTouched(true)
        if (invalid) return
        void work(async () => setPreview(await onPreview(line, draft)))
      }}
    >
      <p className="text-muted-foreground text-sm">
        <strong className="text-foreground">{line.name}</strong> is billed {line.quantity} ×{' '}
        {formatMoney(line.amount)}. Only this contract changes.
      </p>
      <FieldGroup className="gap-4">
        <Field className="gap-2">
          <FieldLabel htmlFor="change-quantity">Quantity</FieldLabel>
          <Input
            id="change-quantity"
            inputMode="decimal"
            autoFocus
            value={quantity}
            disabled={busy}
            aria-invalid={touched && errors.quantity ? true : undefined}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {touched && errors.quantity ? <FieldError>{errors.quantity}</FieldError> : null}
        </Field>

        {line.amountEditable ? (
          <Field className="gap-2">
            <FieldLabel htmlFor="change-amount">Price{currency ? ` (${currency})` : ''}</FieldLabel>
            <Input
              id="change-amount"
              inputMode="decimal"
              value={amount}
              disabled={busy}
              aria-invalid={touched && errors.amount ? true : undefined}
              onChange={(event) => setAmount(event.target.value)}
            />
            {touched && errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
          </Field>
        ) : null}

        <Field className="gap-2">
          <FieldLabel htmlFor="change-date">Effective from</FieldLabel>
          <Input
            id="change-date"
            type="date"
            value={effectiveDate}
            disabled={busy}
            aria-invalid={touched && errors.effectiveDate ? true : undefined}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
          <FieldDescription>
            Leave empty to apply now.
            {period.start && period.end
              ? ` Must fall in this period (${dayFormat.format(period.start)} to ${dayFormat.format(period.end)}).`
              : ''}
          </FieldDescription>
          {touched && errors.effectiveDate ? <FieldError>{errors.effectiveDate}</FieldError> : null}
        </Field>
      </FieldGroup>

      {touched && errors.form ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </Composer>
  )
}

function PreviewSummary({ preview }: { preview: LineChangePreview }) {
  const empty = preview.lines.length === 0 && preview.invoices.length === 0
  return (
    <div className="space-y-3 rounded-md border p-3 text-sm" aria-label="Preview of the change">
      {empty ? <p className="text-muted-foreground">No invoice or line changes result.</p> : null}
      {preview.lines.length ? (
        <ul className="space-y-1.5">
          {preview.lines.map((item, index) => (
            <li key={`${item.id}:${index}`} className="flex flex-wrap justify-between gap-2">
              <span>
                {ACTION_LABEL[item.action] ?? item.action}
                {item.quantity ? ` · quantity ${item.quantity}` : ''}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {item.startDate ? `from ${dayFormat.format(item.startDate)}` : ''}
                {item.endDate ? ` until ${dayFormat.format(item.endDate)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {preview.invoices.length ? (
        <ul className="space-y-1.5 border-t pt-3">
          {preview.invoices.map((item, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2">
              <span>{ACTION_LABEL[item.action] ?? item.action} invoice</span>
              <span className="tabular-nums">
                {item.amountDue ? formatMoney(item.amountDue) : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
