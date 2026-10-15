import { useState } from 'react'
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from '@ui/icons'
import {
  InvoiceStatus,
  type Money,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  PaymentStatus as Payment,
  formatMoney,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { InvoiceLinesEditor, type EditableLine } from './InvoiceLinesEditor'

export const InvoiceEditViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/section',
    'compositions/DateInput',
    'compositions/OptionSelect',
    'pages/InvoiceLinesEditor',
    'compositions/ConfirmDialog',
  ],
  note: "V1's invoice editor: status, payment status, due date, discount, metadata and lines in one save.",
})

/** The invoice as the editor opens it. */
export interface EditableInvoice {
  number: string
  customerName: string
  status: InvoiceStatus
  paymentStatus: PaymentStatus | null
  total: Money
  amountDue: Money
  amountPaid: Money
  amountRemaining: Money
  /** `YYYY-MM-DD`, or blank. */
  dueDate: string
  metadata: Readonly<Record<string, string>>
  lines: EditableLine[]
}

export type InvoiceLifecycleStep = 'keep' | 'finalize' | 'void'

/** What the person asked for. The page works out what changed and saves it. */
export interface InvoiceEditDraft {
  dueDate: string
  metadata: Record<string, string>
  applyDiscount: boolean
  /** `null` keeps the current payment status. */
  paymentStatus: PaymentStatus | null
  /** Pending only: the amount paid so far; blank keeps it. */
  paymentAmount: string
  lines: EditableLine[]
  nextStatus: InvoiceLifecycleStep
}

export interface InvoiceEditViewProps {
  invoice: EditableInvoice
  /** Where the payment status may go — `manualPaymentStatusChoices`. */
  paymentChoices: readonly PaymentStatus[]
  /** Why the payment status cannot be set by hand, or null — `manualPaymentStatusBlocked`. */
  paymentStatusBlocked: string | null
  onSave: (draft: InvoiceEditDraft) => void
  onCancel: () => void
  isSaving?: boolean
  /** A refusal from the API, already a sentence. */
  error?: string | null
}

/** Payment states an invoice can still be voided from (the backend's list). */
const VOIDABLE: readonly PaymentStatus[] = [
  Payment.Pending,
  Payment.Failed,
  Payment.Succeeded,
  Payment.Overpaid,
]

const DECIMAL = /^\d+(\.\d+)?$/

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A line in the form the comparison and the API both read: trimmed, quantity defaulted. */
function normalise(line: EditableLine) {
  return {
    id: line.id ?? '',
    displayName: line.displayName.trim(),
    amount: line.amount.trim(),
    quantity: line.quantity.trim() || '1',
    description: (line.description ?? '').trim(),
    periodStart: line.periodStart ?? '',
    periodEnd: line.periodEnd ?? '',
  }
}

/** Whether the lines differ from what the invoice has, ignoring blank rows never filled in. */
export function linesChanged(before: EditableLine[], after: EditableLine[]): boolean {
  const kept = after.filter((line) => line.id || line.displayName.trim() || line.amount.trim())
  return JSON.stringify(before.map(normalise)) !== JSON.stringify(kept.map(normalise))
}

/**
 * Editing a whole invoice, as V1 does.
 *
 * Everything the API can change is here, saved together: the invoice and
 * payment status, the due date, re-applying discounts, metadata, and the lines
 * themselves — names, notes, amounts, quantities and service periods.
 *
 * A draft changes in place. A finalized invoice keeps its id for the due date,
 * metadata and statuses, but changing its lines or re-applying discounts makes
 * the API void it and carry the changes onto a new draft copy; the page says so
 * up front and asks again before saving.
 */
export function InvoiceEditView({
  invoice,
  paymentChoices,
  paymentStatusBlocked,
  onSave,
  onCancel,
  isSaving = false,
  error = null,
}: InvoiceEditViewProps) {
  const isDraft = invoice.status === InvoiceStatus.Draft
  const [dueDate, setDueDate] = useState(invoice.dueDate)
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [lines, setLines] = useState<EditableLine[]>(invoice.lines)
  const [rows, setRows] = useState(() =>
    Object.entries(invoice.metadata).map(([key, value], index) => ({ id: index, key, value })),
  )
  const [nextRow, setNextRow] = useState(rows.length)
  const [nextStatus, setNextStatus] = useState<InvoiceLifecycleStep>('keep')
  const [problem, setProblem] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const metadata = Object.fromEntries(
    rows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value]),
  )
  const metadataChanged = JSON.stringify(metadata) !== JSON.stringify({ ...invoice.metadata })
  const lineEdit = linesChanged(invoice.lines, lines)
  const paymentChanged =
    paymentStatus !== null &&
    (paymentStatus !== invoice.paymentStatus || paymentAmount.trim() !== '')
  const changed =
    dueDate !== invoice.dueDate ||
    metadataChanged ||
    applyDiscount ||
    paymentChanged ||
    lineEdit ||
    nextStatus !== 'keep'
  const replacesInvoice = !isDraft && (lineEdit || applyDiscount)
  const canVoid = invoice.paymentStatus === null || VOIDABLE.includes(invoice.paymentStatus)

  const draft = (): InvoiceEditDraft => ({
    dueDate,
    metadata,
    applyDiscount,
    paymentStatus: paymentChanged ? paymentStatus : null,
    paymentAmount: paymentAmount.trim(),
    lines,
    nextStatus,
  })

  /** The form's own rules, before anything is sent. */
  const validate = (): string | null => {
    if (dueDate && dueDate !== invoice.dueDate && dueDate < today()) {
      return 'The due date cannot be in the past.'
    }
    const keys = rows.map((row) => row.key.trim()).filter(Boolean)
    if (new Set(keys).size !== keys.length) return 'Each metadata key can appear once.'
    for (const line of lines) {
      const blank = !line.id && !line.displayName.trim() && !line.amount.trim()
      if (blank) continue
      if (!line.displayName.trim()) return 'Every line needs a name.'
      if (!DECIMAL.test(line.amount.trim())) return `Enter an amount for “${line.displayName}”.`
      if (line.quantity.trim() && !DECIMAL.test(line.quantity.trim())) {
        return `Enter a quantity for “${line.displayName}”.`
      }
      if (line.periodStart && line.periodEnd && line.periodEnd < line.periodStart) {
        return `The period of “${line.displayName}” ends before it starts.`
      }
    }
    if (paymentStatus === Payment.Pending && paymentAmount.trim()) {
      if (!DECIMAL.test(paymentAmount.trim())) return 'Enter the amount paid as a number.'
      if (Number(paymentAmount) > Number(invoice.amountDue.amount)) {
        return `The amount paid cannot be more than ${formatMoney(invoice.amountDue)}.`
      }
    }
    if (nextStatus === 'void' && (lineEdit || applyDiscount)) {
      return 'Voiding discards the invoice, so it cannot be combined with line or discount changes.'
    }
    return null
  }

  const submit = () => {
    const issue = validate()
    setProblem(issue)
    if (issue) return
    if (replacesInvoice) return setConfirming(true)
    onSave(draft())
  }

  const statusOptions = [
    { value: 'keep', label: isDraft ? 'Keep as draft' : 'Keep finalized' },
    ...(isDraft ? [{ value: 'finalize', label: 'Finalize the invoice' }] : []),
    ...(canVoid ? [{ value: 'void', label: 'Void the invoice' }] : []),
  ]

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-fit px-0"
            onClick={onCancel}
          >
            <ArrowLeftIcon aria-hidden="true" />
            Back to invoice
          </Button>
          <h1 className="text-xl font-medium">Edit {invoice.number || 'invoice'}</h1>
          <p className="text-muted-foreground text-sm">
            {invoice.customerName} · {formatMoney(invoice.total)} ·{' '}
            {isDraft ? 'Draft' : 'Finalized'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !changed}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {!isDraft ? (
        <Alert>
          <AlertTitle>This invoice is finalized</AlertTitle>
          <AlertDescription>
            The due date, metadata and statuses change in place. Changing lines or re-applying
            discounts voids this invoice and creates a draft copy with your changes; you are asked
            to confirm before that happens.
          </AlertDescription>
        </Alert>
      ) : null}

      {problem || error ? (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {problem ?? error}
        </p>
      ) : null}

      <Section title="Status">
        <div className="grid gap-5 sm:grid-cols-2">
          <label htmlFor="edit-invoice-status" className="flex flex-col gap-1.5 text-sm">
            Invoice status
            <OptionSelect
              id="edit-invoice-status"
              value={nextStatus}
              onValueChange={(value) => setNextStatus(value as InvoiceLifecycleStep)}
              options={statusOptions}
              disabled={isSaving}
            />
            <span className="text-muted-foreground text-xs">
              {nextStatus === 'finalize'
                ? 'Locks the invoice and issues it once the other changes are saved.'
                : nextStatus === 'void'
                  ? 'The invoice is no longer owed. This cannot be undone.'
                  : 'Applied after the other changes.'}
            </span>
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="edit-payment-status">Payment status</label>
            {paymentStatusBlocked ? (
              <p className="text-muted-foreground text-sm">
                {invoice.paymentStatus ? PAYMENT_STATUS_LABEL[invoice.paymentStatus] : 'Not set'} —{' '}
                {paymentStatusBlocked.toLowerCase()}.
              </p>
            ) : (
              <>
                <OptionSelect
                  id="edit-payment-status"
                  value={paymentStatus ?? 'keep'}
                  onValueChange={(value) =>
                    setPaymentStatus(value === 'keep' ? null : (value as PaymentStatus))
                  }
                  options={[
                    {
                      value: 'keep',
                      label: `Keep ${invoice.paymentStatus ? PAYMENT_STATUS_LABEL[invoice.paymentStatus].toLowerCase() : 'as is'}`,
                    },
                    ...paymentChoices
                      .filter(
                        (choice) => choice !== invoice.paymentStatus || choice === Payment.Pending,
                      )
                      .map((choice) => ({
                        value: choice,
                        label:
                          choice === invoice.paymentStatus
                            ? `${PAYMENT_STATUS_LABEL[choice]} — record an amount paid`
                            : PAYMENT_STATUS_LABEL[choice],
                      })),
                  ]}
                  disabled={isSaving}
                />
                <span className="text-muted-foreground text-xs">
                  Paid {formatMoney(invoice.amountPaid)} of {formatMoney(invoice.amountDue)};{' '}
                  {formatMoney(invoice.amountRemaining)} remaining.
                </span>
                {paymentStatus === Payment.Pending ? (
                  <label htmlFor="edit-payment-amount" className="flex flex-col gap-1.5 pt-2">
                    Amount paid so far
                    <Input
                      id="edit-payment-amount"
                      inputMode="decimal"
                      placeholder={invoice.amountPaid.amount}
                      value={paymentAmount}
                      disabled={isSaving}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                    />
                  </label>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Details">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="edit-due-date">Due date</label>
            <DateInput
              id="edit-due-date"
              value={dueDate}
              onValueChange={setDueDate}
              placeholder="No due date"
              disabled={isSaving}
            />
            <span className="text-muted-foreground text-xs">
              When payment is expected. It cannot be in the past.
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-apply-discount">Re-apply discounts</label>
              <span className="text-muted-foreground text-xs">
                Recalculates the discount from this invoice&apos;s coupons.
                {isDraft ? '' : ' On a finalized invoice this creates a draft copy.'}
              </span>
            </div>
            <Switch
              id="edit-apply-discount"
              checked={applyDiscount}
              onCheckedChange={setApplyDiscount}
              disabled={isSaving}
            />
          </div>
        </div>
      </Section>

      {/* The editor names its own section, so it is not wrapped in a second "Lines". */}
      <div className="bg-background rounded-xl border p-5">
        <InvoiceLinesEditor lines={lines} onChange={setLines} disabled={isSaving} />
      </div>

      <Section title="Metadata">
        <div className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No metadata. Add a key to attach one.</p>
          ) : null}
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <Input
                aria-label="Metadata key"
                placeholder="Key"
                value={row.key}
                disabled={isSaving}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r) => (r.id === row.id ? { ...r, key: event.target.value } : r)),
                  )
                }
              />
              <Input
                aria-label="Metadata value"
                placeholder="Value"
                value={row.value}
                disabled={isSaving}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((r) => (r.id === row.id ? { ...r, value: event.target.value } : r)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${row.key || 'this key'}`}
                disabled={isSaving}
                onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={isSaving}
            onClick={() => {
              setRows((current) => [...current, { id: nextRow, key: '', value: '' }])
              setNextRow((n) => n + 1)
            }}
          >
            <PlusIcon aria-hidden="true" />
            Add key
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Replace this invoice with a draft?"
        description={`Changing the lines or re-applying discounts on ${invoice.number || 'a finalized invoice'} voids it and creates a draft copy with your changes. The voided invoice stays on record.`}
        confirmLabel="Void and create draft"
        destructive
        onConfirm={() => {
          setConfirming(false)
          onSave(draft())
        }}
      />
    </form>
  )
}
