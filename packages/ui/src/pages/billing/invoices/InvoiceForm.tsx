import { useRef, useState, type FormEvent } from 'react'
import {
  Building2Icon,
  CalendarIcon,
  CheckIcon,
  ReceiptIcon,
  HashIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { z } from 'zod'
import { type CreateInvoice, createInvoiceSchema, emptyInvoice, sumLineAmounts } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Separator } from '@ui/components/primitives/separator'
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
import {
  COLLECTION_METHOD_OPTIONS,
  CURRENCY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  TAX_RATE_OPTIONS,
  type SelectOption,
} from '@ui/components/blocks/form-3/components/data'
import { format } from 'date-fns'
import { Calendar } from '@ui/components/primitives/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { InvoiceDateField } from '@ui/components/blocks/form-3/components/invoice-date-field'
import { InvoiceSection } from '@ui/components/blocks/form-3/components/invoice-section'
import { InvoiceSummary } from '@ui/components/blocks/form-3/components/invoice-summary'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { usePublishDetailTrail } from '@ui/compositions/shell/ShellDetailTrail'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a one-off invoice with ReUI Form 3.
 *
 * The block is the invoice creator: customer, terms, an editable line-item
 * table, notes, and a live summary. This page keeps that layout and feeds it
 * the customers and the draft this console already has. Line amounts stay
 * exact strings; the total sent is their sum.
 *
 * Preview: https://reui.io/blocks/application/form/form-3
 */
export const InvoiceFormProvenance = provenance({
  source: 'composition',
  composes: [
    'blocks/form-3',
    'ui/card',
    'ui/combobox',
    'ui/field',
    'ui/table',
    'ui/select',
    'compositions/LabelWithHint',
  ],
  note: 'Form 3 invoice creator for create and edit. Line total is sumLineAmounts.',
})

const FORM_ID = 'form-3-invoice'

export interface InvoiceCustomerOption {
  id: string
  name: string
  email: string
}

export interface InvoiceFormProps {
  mode?: 'create' | 'edit'
  customers: readonly InvoiceCustomerOption[]
  /** The way back, then this form. The shell header draws it. */
  trail: DetailCrumb[]
  defaultValue?: CreateInvoice
  /** Shown on edit, when the invoice already has a number. */
  invoiceNumber?: string
  onSubmit: (invoice: CreateInvoice) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

interface Line {
  id: string
  description: string
  quantity: string
  rate: string
  taxRate: string
}

function linesFromDraft(draft: CreateInvoice): Line[] {
  return draft.lines.map((line, index) => {
    const quantity = line.quantity || '1'
    return {
      id: `line-${index + 1}`,
      description: line.description,
      quantity,
      rate: unitRate(quantity, line.amount),
      taxRate: '0',
    }
  })
}

/** Line amount is the total. The rate field is per unit, so edit divides it back. */
function unitRate(quantity: string, amount: string): string {
  const qty = /^(\d+)(?:\.(\d+))?$/.exec(quantity.trim())
  const amt = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim())
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
  const whole = digits.slice(0, -scale)
  const fraction = digits.slice(-scale).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function optionLabel(options: readonly SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function formatMoney(value: number, currency: string) {
  const code = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency: code,
  }).format(value)
}

function lineAmount(line: Line): string | null {
  return mulDecimal(line.quantity, line.rate)
}

/** Exact decimal product, so a typed rate never becomes a float before it is saved. */
function mulDecimal(a: string, b: string): string | null {
  const left = /^(\d+)(?:\.(\d+))?$/.exec(a.trim())
  const right = /^(\d+)(?:\.(\d+))?$/.exec(b.trim())
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

function asNumber(amount: string | null): number {
  if (!amount) return 0
  const value = Number(amount)
  return Number.isFinite(value) ? value : 0
}

function issue(error: z.ZodError, path: string): string | undefined {
  return error.issues.find((item) => item.path.join('.') === path)?.message
}

function currencyError(error: z.ZodError | null): { error: string } | Record<string, never> {
  const message = error ? issue(error, 'currency') : undefined
  return message ? { error: message } : {}
}

export function InvoiceForm({
  mode = 'create',
  customers,
  trail,
  defaultValue,
  invoiceNumber = '',
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: InvoiceFormProps) {
  usePublishDetailTrail(trail)
  const draft = defaultValue ?? emptyInvoice()
  const formRef = useRef<HTMLFormElement>(null)
  const nextLineId = useRef(draft.lines.length + 1)
  const finalizeRef = useRef(false)
  const [lines, setLines] = useState<Line[]>(() => linesFromDraft(draft))
  const [customerId, setCustomerId] = useState(draft.customerId)
  const [taxId, setTaxId] = useState('')
  const [number, setNumber] = useState(invoiceNumber)
  const [poNumber, setPoNumber] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date())
  const [dueDate, setDueDate] = useState<Date | null>(() =>
    draft.dueDate ? new Date(`${draft.dueDate}T00:00:00`) : null,
  )
  const [currency, setCurrency] = useState(draft.currency.toLowerCase() || 'usd')
  const [paymentTerms, setPaymentTerms] = useState('due-receipt')
  const [collectionMethod, setCollectionMethod] = useState('manual')
  const [billingAddress, setBillingAddress] = useState('')
  const [memo, setMemo] = useState(draft.description)
  const [footerNote, setFooterNote] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [error, setError] = useState<z.ZodError | null>(null)

  const customer = customers.find((item) => item.id === customerId) ?? null
  const amounts = lines.map(lineAmount)
  const subtotalText = sumLineAmounts(amounts.map((amount) => amount ?? ''))
  const subtotal = asNumber(subtotalText)
  const discountAmount = subtotal * (discountPercent / 100)
  const taxAmount = lines.reduce((total, line, index) => {
    const amount = asNumber(amounts[index] ?? null)
    return total + amount * (Number(line.taxRate) / 100)
  }, 0)
  const total = Math.max(subtotal - discountAmount + taxAmount, 0)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload: CreateInvoice = {
      customerId,
      currency: currency.toUpperCase(),
      description: memo,
      dueDate: dueDate
        ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`
        : '',
      total: subtotalText ?? '',
      finalize: finalizeRef.current,
      lines: lines.map((line, index) => ({
        description: line.description,
        quantity: line.quantity,
        amount: amounts[index] ?? '',
      })),
    }
    const parsed = createInvoiceSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error)
      return
    }
    setError(null)
    onSubmit(parsed.data)
  }

  const addLine = () => {
    const id = `line-${nextLineId.current}`
    nextLineId.current += 1
    setLines((items) => [...items, { id, description: '', quantity: '1', rate: '', taxRate: '0' }])
  }

  return (
    <>
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
            <h1 className="text-foreground truncate text-base leading-5 font-medium">
              {mode === 'edit' ? 'Edit invoice' : 'New one-off invoice'}
            </h1>
            <Badge
              variant="warning-light"
              className="hidden translate-y-px self-center sm:inline-flex"
            >
              Draft
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="hidden sm:inline-flex"
              disabled={isSubmitting}
              onClick={() => {
                finalizeRef.current = false
                formRef.current?.requestSubmit()
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
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
          <form
            ref={formRef}
            id={FORM_ID}
            onSubmit={submit}
            noValidate
            className="mx-auto my-auto w-full max-w-5xl"
          >
            <Card className="gap-0 p-0">
              <CardHeader className="gap-1 px-5 py-5 sm:px-6">
                <CardTitle>Invoice Details</CardTitle>
                <CardDescription>Customer, terms, items, and payment notes.</CardDescription>
                <CardAction className="flex items-center gap-1.5 self-center">
                  <Badge variant="warning-light">
                    <ReceiptIcon aria-hidden />
                    <span className="sr-only">Status</span>
                    Draft
                  </Badge>
                  {currency ? (
                    <Badge variant="primary-outline" className="hidden sm:inline-flex">
                      {optionLabel(CURRENCY_OPTIONS, currency)}
                    </Badge>
                  ) : null}
                </CardAction>
              </CardHeader>
              <Separator />
              <CardContent className="flex flex-col gap-7 px-5 py-5 sm:px-6 sm:py-6">
                <FieldSet className="gap-0">
                  <FieldLegend className="sr-only">Invoice form</FieldLegend>
                  <FieldDescription className="sr-only">
                    Customer, billing terms, line items, and payment notes.
                  </FieldDescription>
                  <FieldGroup className="gap-7">
                    <InvoiceSection
                      title="Customer"
                      description="Billable account and invoice reference."
                      badge="Required"
                      badgeVariant="success-light"
                    >
                      <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <Field
                          data-invalid={issue(error ?? emptyZod(), 'customerId') ? true : undefined}
                        >
                          <LabelWithHint
                            htmlFor="form-3-customer"
                            hint="This customer becomes the bill-to record on the invoice."
                          >
                            Customer
                          </LabelWithHint>
                          <Combobox
                            items={customers}
                            value={customer}
                            onValueChange={(next) => setCustomerId(next?.id ?? '')}
                            itemToStringLabel={(item) => item.name}
                            itemToStringValue={(item) => item.name}
                          >
                            <ComboboxInput
                              id="form-3-customer"
                              placeholder="Find a customer..."
                              className="w-full"
                              showClear
                              disabled={isSubmitting}
                              aria-invalid={
                                issue(error ?? emptyZod(), 'customerId') ? true : undefined
                              }
                            />
                            <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
                              <ComboboxEmpty>No customers found.</ComboboxEmpty>
                              <ComboboxList>
                                {(item) => (
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
                          {error && issue(error, 'customerId') ? (
                            <p className="text-destructive text-xs" role="alert">
                              {issue(error, 'customerId')}
                            </p>
                          ) : null}
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-tax-id"
                            hint="Shown for finance teams that match invoices against vendor records."
                          >
                            Tax ID
                          </LabelWithHint>
                          <InputGroup>
                            <InputGroupAddon>
                              <Building2Icon aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                              id="form-3-tax-id"
                              value={taxId}
                              disabled={isSubmitting}
                              onChange={(event) => setTaxId(event.target.value)}
                            />
                          </InputGroup>
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-invoice-number"
                            hint="Assigned when the invoice is created. On edit, this is the number already issued."
                          >
                            Invoice Number
                          </LabelWithHint>
                          <InputGroup>
                            <InputGroupAddon>
                              <HashIcon aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                              id="form-3-invoice-number"
                              value={number}
                              disabled={isSubmitting || mode === 'edit'}
                              onChange={(event) => setNumber(event.target.value)}
                            />
                          </InputGroup>
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-po-number"
                            hint="Your customer's purchase order number, printed on the invoice. Optional."
                          >
                            PO Reference
                          </LabelWithHint>
                          <Input
                            id="form-3-po-number"
                            value={poNumber}
                            disabled={isSubmitting}
                            onChange={(event) => setPoNumber(event.target.value)}
                          />
                        </Field>
                      </FieldGroup>
                    </InvoiceSection>

                    <Separator />

                    <InvoiceSection
                      title="Terms"
                      description="Dates, currency, and collection method."
                      badge={optionLabel(PAYMENT_TERMS_OPTIONS, paymentTerms)}
                      badgeVariant="info-light"
                    >
                      <FieldGroup className="grid gap-4 md:grid-cols-3">
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-issue-date"
                            hint="The date shown on the invoice as when it was issued."
                          >
                            Issue Date
                          </LabelWithHint>
                          <InvoiceDateField
                            id="form-3-issue-date"
                            label="Choose issue date"
                            date={issueDate}
                            onSelect={setIssueDate}
                          />
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-due-date"
                            hint="The date payment is expected by."
                          >
                            Due Date
                          </LabelWithHint>
                          <DueDateField id="form-3-due-date" date={dueDate} onSelect={setDueDate} />
                        </Field>
                        <SelectField
                          id="form-3-currency"
                          label="Currency"
                          hint="The currency the invoice is issued in."
                          value={currency}
                          options={CURRENCY_OPTIONS}
                          disabled={isSubmitting}
                          onValueChange={setCurrency}
                          {...currencyError(error)}
                        />
                        <SelectField
                          id="form-3-payment-terms"
                          label="Payment Terms"
                          hint="How long the customer has to pay after the issue date."
                          value={paymentTerms}
                          options={PAYMENT_TERMS_OPTIONS}
                          disabled={isSubmitting}
                          onValueChange={setPaymentTerms}
                        />
                        <SelectField
                          id="form-3-collection-method"
                          label="Collection"
                          hint="Whether the customer is charged automatically or sent the invoice to pay."
                          value={collectionMethod}
                          options={COLLECTION_METHOD_OPTIONS}
                          disabled={isSubmitting}
                          onValueChange={setCollectionMethod}
                        />
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-billing-address"
                            hint="Where the invoice is addressed. Defaults to the customer's address."
                          >
                            Billing Address
                          </LabelWithHint>
                          <Input
                            id="form-3-billing-address"
                            value={billingAddress}
                            disabled={isSubmitting}
                            onChange={(event) => setBillingAddress(event.target.value)}
                          />
                        </Field>
                      </FieldGroup>
                    </InvoiceSection>

                    <Separator />

                    <InvoiceSection
                      title="Line Items"
                      description="Description, quantity, rate, tax, and amount."
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
                      <Table aria-label="Invoice line items" className="min-w-[820px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[42%]">Item</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-36">Rate</TableHead>
                            <TableHead className="w-32">Tax</TableHead>
                            <TableHead className="w-32 text-right">Amount</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, index) => (
                            <TableRow key={line.id}>
                              <TableCell className="align-middle">
                                <Input
                                  aria-label={`Line ${index + 1} description`}
                                  value={line.description}
                                  disabled={isSubmitting}
                                  placeholder="Description"
                                  onChange={(event) =>
                                    updateLine(setLines, line.id, {
                                      description: event.target.value,
                                    })
                                  }
                                />
                                {error && issue(error, `lines.${index}.description`) ? (
                                  <p className="text-destructive mt-1 text-xs" role="alert">
                                    {issue(error, `lines.${index}.description`)}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="align-middle">
                                <Input
                                  inputMode="decimal"
                                  aria-label={`Quantity for line ${index + 1}`}
                                  value={line.quantity}
                                  disabled={isSubmitting}
                                  className="w-20"
                                  onChange={(event) =>
                                    updateLine(setLines, line.id, { quantity: event.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell className="align-middle">
                                <InputGroup className="min-w-28">
                                  <InputGroupAddon>$</InputGroupAddon>
                                  <InputGroupInput
                                    inputMode="decimal"
                                    aria-label={`Line ${index + 1} amount`}
                                    value={line.rate}
                                    disabled={isSubmitting}
                                    onChange={(event) =>
                                      updateLine(setLines, line.id, { rate: event.target.value })
                                    }
                                  />
                                </InputGroup>
                              </TableCell>
                              <TableCell className="align-middle">
                                <Select
                                  value={line.taxRate}
                                  onValueChange={(value) =>
                                    value && updateLine(setLines, line.id, { taxRate: value })
                                  }
                                >
                                  <SelectTrigger
                                    aria-label={`Tax rate for line ${index + 1}`}
                                    className="min-w-24"
                                    disabled={isSubmitting}
                                  >
                                    <SelectValue>
                                      {optionLabel(TAX_RATE_OPTIONS, line.taxRate)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {TAX_RATE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right align-middle font-medium tabular-nums">
                                <span className="inline-flex min-h-9 items-center justify-end">
                                  {formatMoney(asNumber(amounts[index] ?? null), currency || 'USD')}
                                </span>
                              </TableCell>
                              <TableCell className="align-middle">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Remove line ${index + 1}`}
                                  disabled={isSubmitting || lines.length === 1}
                                  onClick={() =>
                                    setLines((items) =>
                                      items.length === 1
                                        ? items
                                        : items.filter((item) => item.id !== line.id),
                                    )
                                  }
                                >
                                  <Trash2Icon aria-hidden />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {error && issue(error, 'lines') ? (
                        <p className="text-destructive text-xs" role="alert">
                          {issue(error, 'lines')}
                        </p>
                      ) : null}
                    </InvoiceSection>

                    <Separator />

                    <InvoiceSection
                      title="Notes"
                      description="Customer-facing memo and payment footer."
                      badge="Optional"
                      badgeVariant="secondary"
                    >
                      <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-memo"
                            hint="A note shown to the customer on the invoice."
                          >
                            Memo
                          </LabelWithHint>
                          <Textarea
                            id="form-3-memo"
                            value={memo}
                            disabled={isSubmitting}
                            onChange={(event) => setMemo(event.target.value)}
                          />
                        </Field>
                        <Field>
                          <LabelWithHint
                            htmlFor="form-3-footer-note"
                            hint="Printed at the bottom of the invoice, for example payment instructions."
                          >
                            Footer Note
                          </LabelWithHint>
                          <Textarea
                            id="form-3-footer-note"
                            value={footerNote}
                            disabled={isSubmitting}
                            onChange={(event) => setFooterNote(event.target.value)}
                          />
                        </Field>
                      </FieldGroup>
                    </InvoiceSection>
                  </FieldGroup>
                </FieldSet>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-4 px-5 py-5 sm:px-6">
                {submitError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <InvoiceSummary
                  subtotal={subtotal}
                  discountPercent={discountPercent}
                  discountAmount={discountAmount}
                  taxAmount={taxAmount}
                  total={total}
                  currency={currency || 'usd'}
                  onDiscountChange={(value) =>
                    setDiscountPercent(Math.min(Math.max(value, 0), 100))
                  }
                />
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </>
  )
}

function emptyZod(): z.ZodError {
  return new z.ZodError([])
}

function updateLine(
  setLines: (update: (items: Line[]) => Line[]) => void,
  id: string,
  patch: Partial<Line>,
) {
  setLines((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
}

function DueDateField({
  id,
  date,
  onSelect,
}: {
  id: string
  date: Date | null
  onSelect: (date: Date) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            id={id}
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label="Choose due date"
          />
        }
      >
        <span className={date ? 'truncate' : 'text-muted-foreground truncate'}>
          {date ? format(date, 'LLL dd, y') : 'Choose a date'}
        </span>
        <CalendarIcon data-icon="inline-end" aria-hidden className="text-muted-foreground/80" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          {...(date ? { selected: date, defaultMonth: date } : {})}
          onSelect={(next) => {
            if (next) onSelect(next)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function SelectField({
  id,
  label,
  hint,
  value,
  options,
  onValueChange,
  disabled,
  error,
}: {
  id: string
  label: string
  hint: string
  value: string
  options: readonly SelectOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <LabelWithHint htmlFor={id} hint={hint}>
        {label}
      </LabelWithHint>
      <Select
        value={value}
        onValueChange={(next) => next && onValueChange(next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={error ? true : undefined}>
          <SelectValue>{value ? optionLabel(options, value) : 'Choose'}</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-(--anchor-width)">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </Field>
  )
}
