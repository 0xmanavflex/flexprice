import { CircleAlertIcon } from '@ui/icons'
import { useState } from 'react'
import {
  formatMoney,
  money,
  validateLineChange,
  type ChangeLineQuantity,
  type LineChangePreview,
  type SubscriptionLine,
} from '@fp/domain'
import { Composer, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { DateInput } from '@ui/compositions/forms/DateInput'
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
    'compositions/date-input',
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
        <PreviewSummary preview={preview} line={line} draft={draft} />
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
          <DateInput
            id="change-date"
            value={effectiveDate}
            disabled={busy}
            clearable
            clearLabel="Clear effective date"
            placeholder="Now"
            aria-invalid={touched && errors.effectiveDate ? true : undefined}
            onValueChange={setEffectiveDate}
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

/** A decimal the dialog validated, as money in the line's currency; the line's own price if it is not one. */
function priceOf(amount: string, line: SubscriptionLine): string {
  try {
    return formatMoney(money(amount, line.amount.currency))
  } catch {
    return formatMoney(line.amount)
  }
}

/** Equal as numbers: "1" and "1.00" are no change. */
const same = (a: string, b: string) => Number(a) === Number(b)

/**
 * What the change does, before it is saved: first what changes on the charge
 * (quantity and price, before and after), then the lines it ends and starts,
 * each with its own quantity, price and dates, then any invoice it raises.
 *
 * The preview names each line's price by id only, so the price shown is the
 * one the dialog knows: the old price on an ended line, the new one on a line
 * the change starts.
 */
function PreviewSummary({
  preview,
  line,
  draft,
}: {
  preview: LineChangePreview
  line: SubscriptionLine
  draft: ChangeLineQuantity
}) {
  const oldPrice = formatMoney(line.amount)
  const newPrice = priceOf(draft.amount, line)
  const changes = [
    {
      id: 'quantity',
      label: 'Quantity',
      before: line.quantity,
      after: draft.quantity,
      changed: !same(line.quantity, draft.quantity),
    },
    ...(line.amountEditable
      ? [
          {
            id: 'price',
            label: 'Price',
            before: oldPrice,
            after: newPrice,
            changed: !same(line.amount.amount, draft.amount),
          },
        ]
      : []),
  ]
  const empty = preview.lines.length === 0 && preview.invoices.length === 0
  // Start over end, so the table fits the dialog without scrolling sideways.
  const inEffect = (item: LineChangePreview['lines'][number]) => (
    <>
      <span className="block">{item.startDate ? dayFormat.format(item.startDate) : '—'} →</span>
      <span className="text-muted-foreground block">
        {item.endDate ? dayFormat.format(item.endDate) : 'Ongoing'}
      </span>
    </>
  )

  return (
    <div className="flex flex-col gap-3" aria-label="Preview of the change">
      <div className="overflow-hidden rounded-md border">
        <SimpleTable
          rows={changes}
          columns={[
            { key: 'label', header: 'Change', cell: (row) => row.label },
            {
              key: 'before',
              header: 'Before',
              className: 'text-right tabular-nums',
              cell: (row) => row.before,
            },
            {
              key: 'after',
              header: 'After',
              className: 'text-right tabular-nums',
              cell: (row) =>
                row.changed ? (
                  <span className="text-foreground font-medium">{row.after}</span>
                ) : (
                  <span className="text-muted-foreground">No change</span>
                ),
            },
          ]}
        />
      </div>

      {empty ? (
        <p className="text-muted-foreground text-sm">No invoice or line changes result.</p>
      ) : null}

      {preview.lines.length ? (
        <div className="overflow-hidden rounded-md border">
          <SimpleTable
            rows={preview.lines.map((item, index) => ({ ...item, key: `${item.id}:${index}` }))}
            getRowId={(row) => row.key}
            columns={[
              {
                key: 'line',
                header: 'Line',
                cell: (row) => ACTION_LABEL[row.action] ?? row.action,
              },
              {
                key: 'quantity',
                header: 'Qty',
                className: 'text-right tabular-nums',
                cell: (row) => row.quantity || '—',
              },
              {
                key: 'price',
                header: 'Price',
                className: 'text-right tabular-nums',
                cell: (row) => (row.action === 'ended' ? oldPrice : newPrice),
              },
              {
                key: 'dates',
                header: 'In effect',
                className: 'tabular-nums whitespace-normal',
                cell: (row) => inEffect(row),
              },
            ]}
          />
        </div>
      ) : null}

      {preview.invoices.length ? (
        <ul className="space-y-1.5 rounded-md border p-3 text-sm">
          {preview.invoices.map((item, index) => {
            // A wallet credit is money back to the customer's wallet, not an invoice: it is
            // named as such and shows the credited amount from its wallet transaction.
            const credit = item.action === 'wallet_credit' || item.walletCredit !== null
            const amount = credit ? item.walletCredit : item.amountDue
            return (
              <li key={index} className="flex flex-wrap justify-between gap-2">
                <span>
                  {credit
                    ? ACTION_LABEL['wallet_credit']
                    : `${ACTION_LABEL[item.action] ?? item.action} invoice`}
                </span>
                <span className="font-medium tabular-nums">
                  {amount ? formatMoney(amount) : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
