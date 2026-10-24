import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { CheckIcon, InfoIcon, PlusIcon, ReceiptIcon, SaveIcon, Trash2Icon, XIcon } from '@ui/icons'
import type { z } from 'zod'
import {
  type CreateInvoice,
  InvoiceStatus,
  type InvoiceTax,
  type Money,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  PaymentStatus as Payment,
  createInvoiceSchema,
  currencyCodes,
  emptyInvoice,
  formatMoney,
  sumLineAmounts,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Button } from '@ui/components/primitives/button'
// eslint-disable-next-line no-restricted-imports -- the redesign's form-3 InvoiceCreator block is built on Card, kept as in the reference
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ui/components/primitives/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@ui/components/primitives/combobox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Separator } from '@ui/components/primitives/separator'
import { Switch } from '@ui/components/primitives/switch'
// eslint-disable-next-line no-restricted-imports -- the redesign's form-3 line-items table uses the table primitive, kept as in the reference
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { Textarea } from '@ui/components/primitives/textarea'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { TotalRow, TotalsList } from '@ui/compositions/detail/DetailKit'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { usePublishDetailTrail } from '@ui/compositions/shell/ShellDetailTrail'
import { provenance } from '@ui/provenance'
import type { EditableLine } from './InvoiceLinesEditor'

/**
 * One invoice form for creating and editing, so the two look and read the same.
 *
 * It follows V1's invoice page: invoice details (customer, number, dates,
 * currency), who it is from and who it bills, the line items with their notes
 * and service periods, the customer's taxes, a memo and metadata, and a summary.
 * Every field here reaches the API — nothing is drawn that is not sent.
 *
 * Editing adds what only an existing invoice has: its status and payment
 * status, and re-applying discounts. Fields the API cannot change after
 * creation (customer, number, issue date, currency, memo) are shown, not
 * offered. A finalized invoice changes in place, except that changing its lines
 * or re-applying discounts makes the API void it and carry the edit onto a new
 * draft — the form says so and asks before saving.
 *
 * Preview of the layout it keeps: https://reui.io/blocks/application/form/form-3
 */
export const InvoiceFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/card',
    'ui/combobox',
    'ui/field',
    'ui/table',
    'compositions/DateInput',
    'compositions/LabelWithHint',
    'compositions/detail-kit',
  ],
  note: 'One create/edit invoice form on the form-3 layout, V1 fields only; line total is quantity × unit price, summed exactly.',
})

const FORM_ID = 'invoice-form'

export interface InvoiceCustomerOption {
  id: string
  name: string
  email: string
}

/** Who the invoice is from, or who it bills, as the From / Bill to blocks print it. */
export interface InvoiceFormParty {
  name: string
  email: string
  /** Address lines, already joined; empty ones left out. */
  address: string[]
}

/** A tax rate the person can add to a new invoice. */
export interface InvoiceTaxRateOption {
  code: string
  name: string
  percentage: string
}

/** The invoice as the form opens it for editing. */
export interface EditableInvoice {
  number: string
  customerName: string
  status: InvoiceStatus
  paymentStatus: PaymentStatus | null
  currency: string
  /** `YYYY-MM-DD`, or blank. */
  issueDate: string
  dueDate: string
  description: string
  amountDue: Money
  amountPaid: Money
  amountRemaining: Money
  tax: Money
  total: Money
  metadata: Readonly<Record<string, string>>
  lines: EditableLine[]
}

export type InvoiceLifecycleStep = 'keep' | 'finalize' | 'void'

/** What an edit asked for; the page works out what changed and saves it. */
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

interface CommonProps {
  /** The way back, then this form. The shell header draws it. */
  trail: DetailCrumb[]
  billFrom?: InvoiceFormParty | null
  billTo?: InvoiceFormParty | null
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export interface InvoiceCreateProps extends CommonProps {
  mode?: 'create'
  customers: readonly InvoiceCustomerOption[]
  defaultValue?: CreateInvoice
  /** The customer changed: the page loads its address and taxes. */
  onCustomerChange?: (customerId: string) => void
  /** Rates that can be added. */
  taxRates?: readonly InvoiceTaxRateOption[]
  /** The chosen customer's tax associations, applied when the customer is picked (as V1 does). */
  customerTaxes?: readonly InvoiceTax[] | null
  onSubmit: (invoice: CreateInvoice) => void
}

export interface InvoiceEditProps extends CommonProps {
  mode: 'edit'
  invoice: EditableInvoice
  /** Where the payment status may go — `manualPaymentStatusChoices`. */
  paymentChoices: readonly PaymentStatus[]
  /** Why the payment status cannot be set by hand, or null — `manualPaymentStatusBlocked`. */
  paymentStatusBlocked: string | null
  onSave: (draft: InvoiceEditDraft) => void
}

export type InvoiceFormProps = InvoiceCreateProps | InvoiceEditProps

/** A line as the form holds it: a unit price, so the amount is quantity × unit. */
interface FormLine {
  key: string
  id?: string
  name: string
  quantity: string
  unit: string
  note: string
  periodStart: string
  periodEnd: string
  /** An existing line's amount, kept until its quantity or price is touched. */
  originalAmount?: string
}

const DECIMAL = /^(\d+)(?:\.(\d+))?$/

/** Exact decimal product, so a typed price never becomes a float before it is saved. */
function mulDecimal(a: string, b: string): string | null {
  const left = DECIMAL.exec(a.trim())
  const right = DECIMAL.exec(b.trim())
  if (!left || !right) return null
  const leftFrac = left[2] ?? ''
  const rightFrac = right[2] ?? ''
  const scale = leftFrac.length + rightFrac.length
  const leftInt = BigInt(left[1]!) * 10n ** BigInt(leftFrac.length) + BigInt(leftFrac || '0')
  const rightInt = BigInt(right[1]!) * 10n ** BigInt(rightFrac.length) + BigInt(rightFrac || '0')
  const digits = (leftInt * rightInt).toString().padStart(scale + 1, '0')
  const whole = scale === 0 ? digits : digits.slice(0, -scale)
  const fraction = (scale === 0 ? '' : digits.slice(-scale)).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** A line's total is its amount; the form edits a unit price, so divide it back. */
function unitPrice(quantity: string, amount: string): string {
  const qty = DECIMAL.exec(quantity.trim())
  const amt = DECIMAL.exec(amount.trim())
  if (!qty || !amt) return amount
  const qtyFrac = qty[2] ?? ''
  const amtFrac = amt[2] ?? ''
  const qtyInt = BigInt(qty[1]!) * 10n ** BigInt(qtyFrac.length) + BigInt(qtyFrac || '0')
  if (qtyInt === 0n) return amount
  const amtInt = BigInt(amt[1]!) * 10n ** BigInt(amtFrac.length) + BigInt(amtFrac || '0')
  const scale = 8
  const quotient =
    (amtInt * 10n ** BigInt(scale + qtyFrac.length)) / (qtyInt * 10n ** BigInt(amtFrac.length))
  const digits = quotient.toString().padStart(scale + 1, '0')
  const fraction = digits.slice(-scale).replace(/0+$/, '')
  return fraction ? `${digits.slice(0, -scale)}.${fraction}` : digits.slice(0, -scale)
}

function lineAmount(line: FormLine): string | null {
  return line.originalAmount ?? mulDecimal(line.quantity || '1', line.unit)
}

function money(amount: string | null, currency: string): string {
  const code = currency.trim().toUpperCase()
  const value = Number(amount ?? '0')
  if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency: code,
  }).format(value)
}

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The comparable form of an edit line: trimmed, quantity defaulted. */
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

const VOIDABLE: readonly PaymentStatus[] = [
  Payment.Pending,
  Payment.Failed,
  Payment.Succeeded,
  Payment.Overpaid,
]

function issue(error: z.ZodError | null, path: string): string | undefined {
  return error?.issues.find((item) => item.path.join('.') === path)?.message
}

let keySeed = 0
const nextKey = () => `line-${++keySeed}`

export function InvoiceForm(props: InvoiceFormProps) {
  const { trail, billFrom = null, billTo = null, onCancel, isSubmitting = false } = props
  const submitError = props.submitError ?? null
  usePublishDetailTrail(trail)
  const edit = props.mode === 'edit' ? props : null
  const create = props.mode === 'edit' ? null : props
  const seed = create?.defaultValue ?? emptyInvoice()

  const [customerId, setCustomerId] = useState(seed.customerId)
  const [invoiceNumber, setInvoiceNumber] = useState(seed.invoiceNumber)
  const [issueDate, setIssueDate] = useState(
    edit ? edit.invoice.issueDate : seed.issueDate || today(),
  )
  const [dueDate, setDueDate] = useState(edit ? edit.invoice.dueDate : seed.dueDate)
  const [currency, setCurrency] = useState(
    (edit ? edit.invoice.currency : seed.currency || 'USD').toUpperCase(),
  )
  const [memo, setMemo] = useState(edit ? edit.invoice.description : seed.description)
  const [lines, setLines] = useState<FormLine[]>(() =>
    edit
      ? edit.invoice.lines.map((line) => ({
          key: nextKey(),
          ...(line.id ? { id: line.id } : {}),
          name: line.displayName,
          quantity: line.quantity || '1',
          unit: unitPrice(line.quantity || '1', line.amount),
          note: line.description ?? '',
          periodStart: line.periodStart ?? '',
          periodEnd: line.periodEnd ?? '',
          originalAmount: line.amount,
        }))
      : seed.lines.map((line) => ({
          key: nextKey(),
          name: line.description,
          quantity: line.quantity || '1',
          unit: line.amount ? unitPrice(line.quantity || '1', line.amount) : '',
          note: line.note,
          periodStart: line.periodStart,
          periodEnd: line.periodEnd,
        })),
  )
  const [taxes, setTaxes] = useState<InvoiceTax[]>(seed.taxes)
  const [taxesFor, setTaxesFor] = useState<string | null>(
    seed.taxes.length > 0 ? seed.customerId : null,
  )
  const [rows, setRows] = useState(() =>
    Object.entries(edit ? edit.invoice.metadata : seed.metadata).map(([key, value]) => ({
      key: nextKey(),
      name: key,
      value,
    })),
  )
  // Edit only.
  const [nextStatus, setNextStatus] = useState<InvoiceLifecycleStep>('keep')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [error, setError] = useState<z.ZodError | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const finalizeRef = useRef(false)

  // V1 applies the chosen customer's tax associations to a new invoice.
  const customerTaxes = create?.customerTaxes ?? null
  useEffect(() => {
    if (!create || !customerId || !customerTaxes || taxesFor === customerId) return
    setTaxes([...customerTaxes])
    setTaxesFor(customerId)
  }, [create, customerId, customerTaxes, taxesFor])

  const amounts = lines.map(lineAmount)
  const subtotal = sumLineAmounts(amounts.map((amount) => amount ?? '')) ?? '0'
  const metadata = Object.fromEntries(
    rows.filter((row) => row.name.trim()).map((row) => [row.name.trim(), row.value]),
  )

  // ---- edit: what changed, and whether it replaces the invoice -------------
  const editLines: EditableLine[] = lines.map((line, index) => ({
    ...(line.id ? { id: line.id } : {}),
    displayName: line.name,
    amount: amounts[index] ?? line.unit,
    quantity: line.quantity,
    description: line.note,
    periodStart: line.periodStart,
    periodEnd: line.periodEnd,
  }))
  const isDraft = edit ? edit.invoice.status === InvoiceStatus.Draft : true
  const lineEdit = edit ? linesChanged(edit.invoice.lines, editLines) : false
  const paymentChanged =
    paymentStatus !== null &&
    (paymentStatus !== edit?.invoice.paymentStatus || paymentAmount.trim() !== '')
  const editChanged = edit
    ? dueDate !== edit.invoice.dueDate ||
      JSON.stringify(metadata) !== JSON.stringify({ ...edit.invoice.metadata }) ||
      applyDiscount ||
      paymentChanged ||
      lineEdit ||
      nextStatus !== 'keep'
    : true
  const replacesInvoice = Boolean(edit) && !isDraft && (lineEdit || applyDiscount)

  const updateLine = (key: string, patch: Partial<FormLine>) =>
    setLines((items) =>
      items.map((item) => {
        if (item.key !== key) return item
        const next = { ...item, ...patch }
        // A changed quantity or price makes the amount the product again.
        if ('quantity' in patch || 'unit' in patch) delete next.originalAmount
        return next
      }),
    )
  const addLine = () =>
    setLines((items) => [
      ...items,
      {
        key: nextKey(),
        name: '',
        quantity: '1',
        unit: '',
        note: '',
        periodStart: '',
        periodEnd: '',
      },
    ])

  const validateEdit = (): string | null => {
    if (!edit) return null
    if (dueDate && dueDate !== edit.invoice.dueDate && dueDate < today()) {
      return 'The due date cannot be in the past.'
    }
    const keys = rows.map((row) => row.name.trim()).filter(Boolean)
    if (new Set(keys).size !== keys.length) return 'Each metadata key can appear once.'
    for (const [index, line] of lines.entries()) {
      const blank = !line.id && !line.name.trim() && !line.unit.trim()
      if (blank) continue
      if (!line.name.trim()) return 'Every line needs a name.'
      if (amounts[index] === null) return `Enter a quantity and price for “${line.name}”.`
      if (line.periodStart && line.periodEnd && line.periodEnd < line.periodStart) {
        return `The period of “${line.name}” ends before it starts.`
      }
    }
    if (paymentStatus === Payment.Pending && paymentAmount.trim()) {
      if (!DECIMAL.test(paymentAmount.trim())) return 'Enter the amount paid as a number.'
      if (Number(paymentAmount) > Number(edit.invoice.amountDue.amount)) {
        return `The amount paid cannot be more than ${formatMoney(edit.invoice.amountDue)}.`
      }
    }
    if (nextStatus === 'void' && (lineEdit || applyDiscount)) {
      return 'Voiding discards the invoice, so it cannot be combined with line or discount changes.'
    }
    return null
  }

  const editDraft = (): InvoiceEditDraft => ({
    dueDate,
    metadata,
    applyDiscount,
    paymentStatus: paymentChanged ? paymentStatus : null,
    paymentAmount: paymentAmount.trim(),
    lines: editLines.filter((line) => line.id || line.displayName.trim() || line.amount.trim()),
    nextStatus,
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (edit) {
      const found = validateEdit()
      setProblem(found)
      if (found) return
      if (replacesInvoice) return setConfirming(true)
      edit.onSave(editDraft())
      return
    }
    if (!create) return
    const keys = rows.map((row) => row.name.trim()).filter(Boolean)
    if (new Set(keys).size !== keys.length) return setProblem('Each metadata key can appear once.')
    setProblem(null)
    const payload: CreateInvoice = {
      customerId,
      currency: currency.toUpperCase(),
      invoiceNumber,
      description: memo,
      issueDate,
      dueDate,
      total: subtotal,
      finalize: finalizeRef.current,
      metadata,
      taxes,
      lines: lines.map((line, index) => ({
        description: line.name,
        quantity: line.quantity,
        amount: amounts[index] ?? '',
        note: line.note,
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
      })),
    }
    const parsed = createInvoiceSchema.safeParse(payload)
    if (!parsed.success) return setError(parsed.error)
    setError(null)
    create.onSubmit(parsed.data)
  }

  const customer = create?.customers.find((item) => item.id === customerId) ?? null
  const statusLabel = isDraft ? 'Draft' : 'Finalized'
  const title = edit ? `Edit ${edit.invoice.number || 'invoice'}` : 'New invoice'
  const availableRates = (create?.taxRates ?? []).filter(
    (rate) => !taxes.some((tax) => tax.taxRateCode === rate.code),
  )
  const canVoid =
    edit !== null &&
    (edit.invoice.paymentStatus === null || VOIDABLE.includes(edit.invoice.paymentStatus))

  return (
    <div className="bg-background flex min-h-0 w-full flex-1 flex-col">
      <header className="border-border bg-background/95 sticky top-0 z-20 flex min-h-14 w-full shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          {onCancel ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-ms-2 size-8 shrink-0"
                aria-label="Close form"
                disabled={isSubmitting}
                onClick={onCancel}
              >
                <XIcon aria-hidden="true" />
              </Button>
              <Separator orientation="vertical" className="my-auto mr-2 h-4 shrink-0" />
            </>
          ) : null}
          {/* The status sits once, on the details card below, not here as well. */}
          <h1 className="text-foreground truncate text-base leading-5 font-medium">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {edit ? (
            <>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" form={FORM_ID} disabled={isSubmitting || !editChanged}>
                <CheckIcon data-icon="inline-start" aria-hidden />
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                form={FORM_ID}
                variant="outline"
                className="hidden sm:inline-flex"
                disabled={isSubmitting}
                onClick={() => {
                  finalizeRef.current = false
                }}
              >
                <SaveIcon data-icon="inline-start" aria-hidden />
                Save draft
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting}
                onClick={() => {
                  finalizeRef.current = true
                }}
              >
                <CheckIcon data-icon="inline-start" aria-hidden />
                Finalize invoice
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
        <form
          id={FORM_ID}
          onSubmit={submit}
          noValidate
          className="mx-auto my-auto w-full max-w-5xl"
        >
          <Card className="gap-0 p-0">
            <CardHeader className="gap-1 px-5 py-5 sm:px-6">
              <CardTitle>Invoice details</CardTitle>
              <CardDescription>
                {edit
                  ? 'Change the dates, lines, statuses and metadata of this invoice.'
                  : 'Customer, dates, items and taxes for a one-off invoice.'}
              </CardDescription>
              <CardAction className="flex items-center gap-1.5 self-center">
                <Badge variant={isDraft ? 'warning-light' : 'info-light'}>
                  {/* Sized here: an animated icon's wrapper is 24px unless told otherwise,
                      and the badge only sizes a bare svg, so it spilled out of the badge. */}
                  <ReceiptIcon aria-hidden className="size-3" />
                  <span className="sr-only">Status</span>
                  {statusLabel}
                </Badge>
                {currency ? (
                  <Badge variant="primary-outline" className="hidden sm:inline-flex">
                    {currency}
                  </Badge>
                ) : null}
              </CardAction>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-7 px-5 py-5 sm:px-6 sm:py-6">
              {edit && !isDraft ? (
                <Alert>
                  <InfoIcon aria-hidden="true" />
                  <AlertTitle>This invoice is finalized</AlertTitle>
                  <AlertDescription>
                    The due date, metadata and statuses change in place. Changing lines or
                    re-applying discounts voids this invoice and creates a draft copy with your
                    changes; you are asked to confirm first.
                  </AlertDescription>
                </Alert>
              ) : null}
              <FieldSet className="gap-0">
                <FieldLegend className="sr-only">Invoice form</FieldLegend>
                <FieldDescription className="sr-only">
                  Customer, dates, line items, taxes and notes.
                </FieldDescription>
                <FieldGroup className="gap-7">
                  <InvoiceFormSection
                    title="Customer"
                    description="Who the invoice bills, and its number."
                    {...(edit ? {} : { badge: 'Required', badgeVariant: 'success-light' as const })}
                  >
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field data-invalid={issue(error, 'customerId') ? true : undefined}>
                        <LabelWithHint
                          htmlFor="invoice-customer"
                          hint={
                            edit
                              ? 'An invoice keeps the customer it was raised for.'
                              : 'This customer becomes the bill-to record on the invoice.'
                          }
                        >
                          Customer
                        </LabelWithHint>
                        {create ? (
                          <Combobox
                            items={create.customers}
                            value={customer}
                            onValueChange={(next) => {
                              setCustomerId(next?.id ?? '')
                              create.onCustomerChange?.(next?.id ?? '')
                            }}
                            itemToStringLabel={(item) => item.name}
                            itemToStringValue={(item) => item.name}
                          >
                            <ComboboxInput
                              id="invoice-customer"
                              placeholder="Find a customer..."
                              className="w-full"
                              showClear
                              disabled={isSubmitting}
                              aria-invalid={issue(error, 'customerId') ? true : undefined}
                            />
                            <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
                              <ComboboxEmpty>No customers found.</ComboboxEmpty>
                              <ComboboxList>
                                {(item: InvoiceCustomerOption) => (
                                  <ComboboxItem key={item.id} value={item}>
                                    <span className="flex min-w-0 flex-col">
                                      <span className="truncate">{item.name}</span>
                                      {item.email ? (
                                        <span className="text-muted-foreground truncate text-xs">
                                          {item.email}
                                        </span>
                                      ) : null}
                                    </span>
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        ) : (
                          <Input
                            id="invoice-customer"
                            value={edit?.invoice.customerName}
                            disabled
                          />
                        )}
                        <FieldError message={issue(error, 'customerId')} />
                      </Field>
                      <Field>
                        <LabelWithHint
                          htmlFor="invoice-number"
                          hint={
                            edit
                              ? 'The number the invoice was issued with.'
                              : 'Optional. Flexprice numbers the invoice when left blank.'
                          }
                        >
                          Invoice number
                        </LabelWithHint>
                        <Input
                          id="invoice-number"
                          value={edit ? edit.invoice.number : invoiceNumber}
                          placeholder={edit ? 'Assigned when finalized' : 'Assigned automatically'}
                          disabled={isSubmitting || Boolean(edit)}
                          onChange={(event) => setInvoiceNumber(event.target.value)}
                        />
                        <FieldError message={issue(error, 'invoiceNumber')} />
                      </Field>
                    </FieldGroup>
                    <div className="bg-muted/30 grid gap-6 rounded-lg border p-4 md:grid-cols-2">
                      <PartyBlock label="From" party={billFrom} />
                      <PartyBlock
                        label="Bill to"
                        party={billTo}
                        empty={create ? 'Choose a customer to see their billing details.' : '—'}
                      />
                    </div>
                  </InvoiceFormSection>

                  <Separator />

                  <InvoiceFormSection
                    title="Dates and currency"
                    description="When it is issued and due, and what it is billed in."
                  >
                    <FieldGroup className="grid gap-4 md:grid-cols-3">
                      <Field data-invalid={issue(error, 'issueDate') ? true : undefined}>
                        <LabelWithHint
                          htmlFor="invoice-issue-date"
                          hint={
                            edit
                              ? 'Fixed once the invoice exists.'
                              : 'The date printed as when the invoice was issued.'
                          }
                        >
                          Issue date
                        </LabelWithHint>
                        <DateInput
                          id="invoice-issue-date"
                          value={issueDate}
                          onValueChange={setIssueDate}
                          placeholder="Today"
                          disabled={isSubmitting || Boolean(edit)}
                        />
                      </Field>
                      <Field data-invalid={issue(error, 'dueDate') ? true : undefined}>
                        <LabelWithHint
                          htmlFor="invoice-due-date"
                          hint="When payment is expected. It cannot be in the past."
                        >
                          Due date
                        </LabelWithHint>
                        <DateInput
                          id="invoice-due-date"
                          value={dueDate}
                          onValueChange={setDueDate}
                          placeholder="No due date"
                          disabled={isSubmitting}
                        />
                      </Field>
                      <Field data-invalid={issue(error, 'currency') ? true : undefined}>
                        <LabelWithHint
                          htmlFor="invoice-currency"
                          hint={
                            edit
                              ? 'Fixed once the invoice exists.'
                              : 'The currency the invoice is issued in.'
                          }
                        >
                          Currency
                        </LabelWithHint>
                        <OptionSelect
                          id="invoice-currency"
                          value={currency}
                          onValueChange={setCurrency}
                          options={currencyCodes().map((code) => ({ value: code, label: code }))}
                          disabled={isSubmitting || Boolean(edit)}
                        />
                        <FieldError message={issue(error, 'currency')} />
                      </Field>
                    </FieldGroup>
                  </InvoiceFormSection>

                  <Separator />

                  <InvoiceFormSection
                    title="Line items"
                    description="What the invoice charges for: quantity × unit price, with a note and service period."
                    badge={`${lines.length} item${lines.length === 1 ? '' : 's'}`}
                    badgeVariant="secondary"
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={addLine}
                      >
                        <PlusIcon data-icon="inline-start" aria-hidden />
                        Add item
                      </Button>
                    }
                  >
                    <Table aria-label="Invoice line items" className="min-w-[760px]">
                      <TableHeader>
                        {/* The invoice document's column heads (muted, small, regular), so the
                            lines read the same while drafting as on the finished invoice. */}
                        <TableRow className="[&>th]:text-muted-foreground [&>th]:text-xs [&>th]:font-normal">
                          <TableHead className="w-[44%]">Item</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                          <TableHead className="w-40">Unit price</TableHead>
                          <TableHead className="w-32 text-right">Amount</TableHead>
                          <TableHead className="w-10">
                            <span className="sr-only">Remove</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, index) => (
                          <LineRows
                            key={line.key}
                            line={line}
                            index={index}
                            amount={amounts[index] ?? null}
                            currency={currency}
                            disabled={isSubmitting}
                            canRemove={Boolean(edit) || lines.length > 1}
                            nameError={issue(error, `lines.${index}.description`)}
                            amountError={
                              issue(error, `lines.${index}.amount`) ??
                              issue(error, `lines.${index}.quantity`)
                            }
                            periodError={issue(error, `lines.${index}.periodEnd`)}
                            onChange={(patch) => updateLine(line.key, patch)}
                            onRemove={() =>
                              setLines((items) => items.filter((item) => item.key !== line.key))
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                    {lines.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No lines. Add one, or the invoice bills nothing.
                      </p>
                    ) : null}
                    <FieldError message={issue(error, 'lines')} />
                  </InvoiceFormSection>

                  <Separator />

                  {create ? (
                    <InvoiceFormSection
                      title="Taxes"
                      description="Applied by Flexprice on top of the lines. Starts from the customer's tax rates."
                      badge={`${taxes.length} rate${taxes.length === 1 ? '' : 's'}`}
                      badgeVariant="secondary"
                    >
                      <div className="flex flex-col gap-2">
                        {taxes.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No taxes are applied.</p>
                        ) : (
                          taxes.map((tax) => (
                            <div
                              key={tax.taxRateCode}
                              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                  {tax.name || tax.taxRateCode}
                                  {tax.percentage ? ` · ${tax.percentage}%` : ''}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {tax.taxRateCode} ·{' '}
                                  {tax.taxBehavior === 'inclusive'
                                    ? 'Included in the price'
                                    : 'Added on top of the price'}
                                </span>
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove ${tax.name || tax.taxRateCode}`}
                                disabled={isSubmitting}
                                onClick={() =>
                                  setTaxes((items) =>
                                    items.filter((item) => item.taxRateCode !== tax.taxRateCode),
                                  )
                                }
                              >
                                <Trash2Icon aria-hidden />
                              </Button>
                            </div>
                          ))
                        )}
                        {availableRates.length > 0 ? (
                          <div className="max-w-xs">
                            <OptionSelect
                              aria-describedby={undefined}
                              value={undefined}
                              placeholder="Add a tax rate"
                              disabled={isSubmitting}
                              options={availableRates.map((rate) => ({
                                value: rate.code,
                                label: `${rate.name}${rate.percentage ? ` (${rate.percentage}%)` : ''}`,
                              }))}
                              onValueChange={(code) => {
                                const rate = availableRates.find((item) => item.code === code)
                                if (!rate) return
                                setTaxes((items) => [
                                  ...items,
                                  {
                                    taxRateCode: rate.code,
                                    name: rate.name,
                                    percentage: rate.percentage,
                                    taxBehavior: 'exclusive',
                                    priority: items.length + 1,
                                    autoApply: true,
                                  },
                                ])
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </InvoiceFormSection>
                  ) : (
                    <InvoiceFormSection
                      title="Status and payment"
                      description="Applied after the other changes are saved."
                    >
                      <FieldGroup className="grid gap-4 md:grid-cols-3">
                        <Field>
                          <LabelWithHint
                            htmlFor="invoice-next-status"
                            hint="Finalize locks a draft and issues it; void means it is no longer owed."
                          >
                            Invoice status
                          </LabelWithHint>
                          <OptionSelect
                            id="invoice-next-status"
                            value={nextStatus}
                            onValueChange={(value) => setNextStatus(value as InvoiceLifecycleStep)}
                            options={[
                              {
                                value: 'keep',
                                label: isDraft ? 'Keep as draft' : 'Keep finalized',
                              },
                              ...(isDraft ? [{ value: 'finalize', label: 'Finalize' }] : []),
                              ...(canVoid ? [{ value: 'void', label: 'Void' }] : []),
                            ]}
                            disabled={isSubmitting}
                          />
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="invoice-payment-status"
                            hint="For money that moved outside Flexprice."
                          >
                            Payment status
                          </LabelWithHint>
                          {edit?.paymentStatusBlocked ? (
                            <p className="text-muted-foreground text-sm">
                              {edit.invoice.paymentStatus
                                ? PAYMENT_STATUS_LABEL[edit.invoice.paymentStatus]
                                : 'Not set'}{' '}
                              — {edit.paymentStatusBlocked.toLowerCase()}.
                            </p>
                          ) : (
                            <OptionSelect
                              id="invoice-payment-status"
                              value={paymentStatus ?? 'keep'}
                              onValueChange={(value) =>
                                setPaymentStatus(value === 'keep' ? null : (value as PaymentStatus))
                              }
                              options={[
                                {
                                  value: 'keep',
                                  label: `Keep ${
                                    edit?.invoice.paymentStatus
                                      ? PAYMENT_STATUS_LABEL[
                                          edit.invoice.paymentStatus
                                        ].toLowerCase()
                                      : 'as is'
                                  }`,
                                },
                                ...(edit?.paymentChoices ?? [])
                                  .filter(
                                    (choice) =>
                                      choice !== edit?.invoice.paymentStatus ||
                                      choice === Payment.Pending,
                                  )
                                  .map((choice) => ({
                                    value: choice,
                                    label:
                                      choice === edit?.invoice.paymentStatus
                                        ? `${PAYMENT_STATUS_LABEL[choice]} — record an amount`
                                        : PAYMENT_STATUS_LABEL[choice],
                                  })),
                              ]}
                              disabled={isSubmitting}
                            />
                          )}
                          {edit ? (
                            <p className="text-muted-foreground text-xs">
                              Paid {formatMoney(edit.invoice.amountPaid)} of{' '}
                              {formatMoney(edit.invoice.amountDue)}.
                            </p>
                          ) : null}
                        </Field>
                        {paymentStatus === Payment.Pending ? (
                          <Field>
                            <LabelWithHint
                              htmlFor="invoice-payment-amount"
                              hint="Optional. Leave blank to keep what is recorded."
                            >
                              Amount paid so far
                            </LabelWithHint>
                            <InputGroup>
                              <InputGroupInput
                                id="invoice-payment-amount"
                                inputMode="decimal"
                                placeholder={edit?.invoice.amountPaid.amount}
                                value={paymentAmount}
                                disabled={isSubmitting}
                                onChange={(event) => setPaymentAmount(event.target.value)}
                              />
                              <InputGroupAddon align="inline-end">{currency}</InputGroupAddon>
                            </InputGroup>
                          </Field>
                        ) : (
                          <Field>
                            <LabelWithHint
                              htmlFor="invoice-apply-discount"
                              hint={
                                isDraft
                                  ? "Recalculates the discount from this invoice's coupons."
                                  : "Recalculates the discount from this invoice's coupons, on a draft copy."
                              }
                            >
                              Re-apply discounts
                            </LabelWithHint>
                            <Switch
                              id="invoice-apply-discount"
                              checked={applyDiscount}
                              onCheckedChange={setApplyDiscount}
                              disabled={isSubmitting}
                            />
                          </Field>
                        )}
                      </FieldGroup>
                    </InvoiceFormSection>
                  )}

                  <Separator />

                  <InvoiceFormSection
                    title="Notes"
                    description="A memo printed on the invoice, and metadata for your own systems."
                    badge="Optional"
                    badgeVariant="secondary"
                  >
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <LabelWithHint
                          htmlFor="invoice-memo"
                          hint={
                            edit
                              ? 'Fixed once the invoice exists.'
                              : 'A note shown to the customer on the invoice.'
                          }
                        >
                          Memo
                        </LabelWithHint>
                        <Textarea
                          id="invoice-memo"
                          value={memo}
                          placeholder={edit ? 'No memo' : undefined}
                          disabled={isSubmitting || Boolean(edit)}
                          onChange={(event) => setMemo(event.target.value)}
                        />
                      </Field>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Metadata</span>
                        {rows.map((row) => (
                          <div
                            key={row.key}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
                          >
                            <Input
                              aria-label="Metadata key"
                              placeholder="Key"
                              value={row.name}
                              disabled={isSubmitting}
                              onChange={(event) =>
                                setRows((items) =>
                                  items.map((item) =>
                                    item.key === row.key
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <Input
                              aria-label="Metadata value"
                              placeholder="Value"
                              value={row.value}
                              disabled={isSubmitting}
                              onChange={(event) =>
                                setRows((items) =>
                                  items.map((item) =>
                                    item.key === row.key
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${row.name || 'this key'}`}
                              disabled={isSubmitting}
                              onClick={() =>
                                setRows((items) => items.filter((item) => item.key !== row.key))
                              }
                            >
                              <Trash2Icon aria-hidden />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          disabled={isSubmitting}
                          onClick={() =>
                            setRows((items) => [...items, { key: nextKey(), name: '', value: '' }])
                          }
                        >
                          <PlusIcon data-icon="inline-start" aria-hidden />
                          Add key
                        </Button>
                      </div>
                    </FieldGroup>
                  </InvoiceFormSection>
                </FieldGroup>
              </FieldSet>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-4 px-5 py-5 sm:px-6">
              {problem || submitError ? (
                <p className="text-destructive text-sm" role="alert">
                  {problem ?? submitError}
                </p>
              ) : null}
              <Summary
                subtotal={money(subtotal, currency)}
                tax={
                  edit && !lineEdit
                    ? formatMoney(edit.invoice.tax)
                    : taxes.length > 0 || edit
                      ? 'Calculated by Flexprice'
                      : money('0', currency)
                }
                total={
                  edit && !lineEdit ? formatMoney(edit.invoice.total) : money(subtotal, currency)
                }
                totalLabel={edit && !lineEdit ? 'Total' : 'Total before tax'}
              />
            </CardFooter>
          </Card>
        </form>
      </div>

      {edit ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Replace this invoice with a draft?"
          description={`Changing the lines or re-applying discounts on ${edit.invoice.number || 'a finalized invoice'} voids it and creates a draft copy with your changes. The voided invoice stays on record.`}
          confirmLabel="Void and create draft"
          destructive
          onConfirm={() => {
            setConfirming(false)
            edit.onSave(editDraft())
          }}
        />
      ) : null}
    </div>
  )
}

/** One line: the item row, then its note and service period beneath it. */
function LineRows({
  line,
  index,
  amount,
  currency,
  disabled,
  canRemove,
  nameError,
  amountError,
  periodError,
  onChange,
  onRemove,
}: {
  line: FormLine
  index: number
  amount: string | null
  currency: string
  disabled: boolean
  canRemove: boolean
  nameError: string | undefined
  amountError: string | undefined
  periodError: string | undefined
  onChange: (patch: Partial<FormLine>) => void
  onRemove: () => void
}) {
  return (
    <>
      <TableRow className="border-b-0">
        <TableCell className="align-top">
          <Input
            aria-label={`Line ${index + 1} name`}
            value={line.name}
            disabled={disabled}
            placeholder="What this line charges for"
            onChange={(event) => onChange({ name: event.target.value })}
          />
          <FieldError message={nameError} />
        </TableCell>
        <TableCell className="align-top">
          <Input
            inputMode="decimal"
            aria-label={`Quantity for line ${index + 1}`}
            value={line.quantity}
            disabled={disabled}
            className="w-20"
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </TableCell>
        <TableCell className="align-top">
          <InputGroup className="min-w-28">
            <InputGroupAddon>{currency}</InputGroupAddon>
            <InputGroupInput
              inputMode="decimal"
              aria-label={`Unit price for line ${index + 1}`}
              value={line.unit}
              placeholder="0.00"
              disabled={disabled}
              onChange={(event) => onChange({ unit: event.target.value })}
            />
          </InputGroup>
          <FieldError message={amountError} />
        </TableCell>
        <TableCell className="text-right align-top font-medium tabular-nums">
          <span className="inline-flex min-h-9 items-center justify-end">
            {money(amount, currency)}
          </span>
        </TableCell>
        <TableCell className="align-top">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove line ${index + 1}`}
            disabled={disabled || !canRemove}
            onClick={onRemove}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} className="pt-0">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
            <Input
              aria-label={`Note for line ${index + 1}`}
              value={line.note}
              disabled={disabled}
              placeholder="Note, printed under the line (optional)"
              onChange={(event) => onChange({ note: event.target.value })}
            />
            <DateInput
              value={line.periodStart}
              onValueChange={(periodStart) => onChange({ periodStart })}
              placeholder="Period from"
              disabled={disabled}
            />
            <DateInput
              value={line.periodEnd}
              onValueChange={(periodEnd) => onChange({ periodEnd })}
              placeholder="Period to"
              disabled={disabled}
            />
          </div>
          <FieldError message={periodError} />
        </TableCell>
      </TableRow>
    </>
  )
}

function PartyBlock({
  label,
  party,
  empty = '—',
}: {
  label: string
  party: InvoiceFormParty | null
  empty?: string
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {party ? (
        <>
          <span className="font-medium">{party.name || '—'}</span>
          {party.email ? <span className="text-muted-foreground">{party.email}</span> : null}
          {party.address.map((line) => (
            <span key={line} className="text-muted-foreground">
              {line}
            </span>
          ))}
        </>
      ) : (
        <span className="text-muted-foreground">{empty}</span>
      )}
    </div>
  )
}

function Summary({
  subtotal,
  tax,
  total,
  totalLabel,
}: {
  subtotal: string
  tax: string
  total: string
  totalLabel: string
}) {
  return (
    <TotalsList className="ml-auto">
      <TotalRow label="Subtotal" value={subtotal} />
      <TotalRow label="Tax" value={tax} />
      <TotalRow label={totalLabel} value={total} emphasis="due" rule />
    </TotalsList>
  )
}

/**
 * A titled group inside the invoice card. The form-3 block's own section heads
 * its groups in semibold at a larger size, which no other form uses; this keeps
 * its layout and gives the title the console's section-title type (the size and
 * weight of `Section`, `FormCard` and `Panel` titles).
 */
function InvoiceFormSection({
  title,
  description,
  badge,
  badgeVariant = 'secondary',
  action,
  children,
}: {
  title: string
  description?: string
  badge?: string
  badgeVariant?: ComponentProps<typeof Badge>['variant']
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-foreground text-sm font-medium">{title}</h2>
            {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          </div>
          {description ? <p className="text-muted-foreground text-[13px]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? (
    <p className="text-destructive mt-1 text-xs" role="alert">
      {message}
    </p>
  ) : null
}
