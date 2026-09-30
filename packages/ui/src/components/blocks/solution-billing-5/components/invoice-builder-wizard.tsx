// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useRef, useState, type FormEvent, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@ui/components/reui/alert"
import { Badge, type BadgeProps } from "@ui/components/reui/badge"
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@ui/components/reui/stepper"
import { cn } from "cn"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/components/primitives/avatar"
import { Button } from "@ui/components/primitives/button"
import { Calendar } from "@ui/components/primitives/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/primitives/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@ui/components/primitives/combobox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/components/primitives/field"
import { Input } from "@ui/components/primitives/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@ui/components/primitives/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ui/components/primitives/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"
import { Separator } from "@ui/components/primitives/separator"
import { Spinner } from "@ui/components/primitives/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ui/components/primitives/table"
import {
  COLLECTION_METHOD_OPTIONS,
  createInvoiceLine,
  CURRENCY_OPTIONS,
  DEFAULT_INVOICE_FORM_VALUES,
  DEFAULT_INVOICE_LINES,
  INVOICE_CUSTOMERS,
  INVOICE_PREPARER,
  INVOICE_PRODUCTS,
  PAYMENT_TERMS_OPTIONS,
  PRODUCT_BY_ID,
  TAX_RATE_OPTIONS,
  WIZARD_STEPS,
  type InvoiceCustomer,
  type InvoiceLineItem,
  type SelectOption,
  type WizardStep,
} from "./data"
import { CircleCheckIcon, CalendarIcon, AlertCircleIcon, Building2Icon, HashIcon, Trash2Icon, PlusIcon, ReceiptIcon, ArrowLeftIcon, SendIcon, ArrowRightIcon } from "lucide-react"

const FORM_ID = "solution-billing-5-invoice-builder-form"
const CONTENT_MAX_WIDTH_CLASS = "max-w-4xl"

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

function getOptionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function getLineSubtotal(line: InvoiceLineItem) {
  return line.quantity * line.unitPrice
}

function getLineTax(line: InvoiceLineItem) {
  return getLineSubtotal(line) * (Number(line.taxRate) / 100)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, 0), 100)
}

function InvoiceToastTitle({
  icon,
  children,
}: {
  icon: ReactNode
  children: string
}) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function InvoiceToastDescription({ children }: { children: string }) {
  return (
    <span className="grid grid-cols-[1rem_1fr] gap-2">
      <span aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}

function showInvoiceToast(title: string, description: string) {
  toast.success(
    <InvoiceToastTitle
      icon={
        <CircleCheckIcon className="text-success size-4 shrink-0" aria-hidden="true" />
      }
    >
      {title}
    </InvoiceToastTitle>,
    {
      description: (
        <InvoiceToastDescription>{description}</InvoiceToastDescription>
      ),
      icon: null,
    }
  )
}

function InvoiceSection({
  title,
  description,
  badge,
  badgeVariant = "secondary",
  action,
  children,
}: {
  title: string
  description?: string
  badge?: string
  badgeVariant?: BadgeProps["variant"]
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-foreground text-base leading-6 font-semibold">
              {title}
            </h2>
            {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          </div>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </section>
  )
}

function InvoiceSelectField({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string
  label: string
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{getOptionLabel(options, value)}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="w-(--anchor-width)"
        >
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function InvoiceDateField({
  id,
  label,
  date,
  onSelect,
}: {
  id: string
  label: string
  date: Date
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
            aria-label={label}
          >
            <span className="truncate">{formatDate(date)}</span>
            <CalendarIcon data-icon="inline-end" aria-hidden="true" className="text-muted-foreground/80" />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(nextDate) => {
            if (nextDate) {
              onSelect(nextDate)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function InvoiceHeaderSummary({
  status,
  isSent,
  invoiceNumber,
}: {
  status: string
  isSent: boolean
  invoiceNumber: string
}) {
  return (
    <Badge
      variant={isSent ? "success-outline" : "warning-outline"}
      className="bg-background gap-1.5"
      aria-label={`Invoice status: ${status} ${invoiceNumber}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isSent ? "bg-success" : "bg-warning"
        )}
        aria-hidden="true"
      />
      {status} {invoiceNumber}
    </Badge>
  )
}

function InvoiceStepNav({ steps }: { steps: WizardStep[] }) {
  return (
    <StepperNav
      aria-label="Invoice progress"
      className="min-w-full items-start"
    >
      {steps.map((step, index) => (
        <StepperItem
          key={step.id}
          step={step.value}
          className="relative min-w-0 flex-1 overflow-visible"
        >
          <StepperTrigger
            type="button"
            aria-label={step.title}
            className="w-full min-w-0 flex-col items-center justify-start gap-2 px-0 text-center"
          >
            <StepperIndicator className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=inactive]:border-border data-[state=inactive]:bg-background data-[state=inactive]:text-foreground data-[state=active]:before:border-primary relative isolate size-6 overflow-visible rounded-full border border-transparent before:pointer-events-none before:absolute before:inset-0 before:z-10 before:rounded-full before:border before:border-dashed before:border-transparent before:content-[''] data-[state=active]:border-0 data-[state=active]:before:animate-[spin_8s_linear_infinite] motion-reduce:data-[state=active]:before:animate-none">
              {index + 1}
            </StepperIndicator>
            <StepperTitle className="max-w-20 text-center leading-tight whitespace-normal sm:max-w-full">
              {step.title}
            </StepperTitle>
          </StepperTrigger>
          {index < steps.length - 1 ? (
            <StepperSeparator className="group-data-[state=completed]/step:bg-primary absolute top-3 left-[calc(50%+1.125rem)] m-0 w-[calc(100%-2.25rem)] flex-none" />
          ) : null}
        </StepperItem>
      ))}
    </StepperNav>
  )
}

function CustomerStep({
  selectedCustomer,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  paymentTerms,
  collectionMethod,
  hasCustomerError,
  onCustomerChange,
  onIssueDateChange,
  onDueDateChange,
  onCurrencyChange,
  onPaymentTermsChange,
  onCollectionMethodChange,
}: {
  selectedCustomer: InvoiceCustomer | null
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
  currency: string
  paymentTerms: string
  collectionMethod: string
  hasCustomerError: boolean
  onCustomerChange: (customer: InvoiceCustomer | null) => void
  onIssueDateChange: (date: Date) => void
  onDueDateChange: (date: Date) => void
  onCurrencyChange: (value: string) => void
  onPaymentTermsChange: (value: string) => void
  onCollectionMethodChange: (value: string) => void
}) {
  return (
    <>
      <InvoiceSection
        title="Customer"
        description="Billable account and invoice reference."
        badge="Required"
        badgeVariant="success-light"
      >
        {hasCustomerError ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" aria-hidden="true" />
            <AlertTitle>Select a customer</AlertTitle>
            <AlertDescription>
              <p>
                Choose a billable account before adding line items to{" "}
                {invoiceNumber}.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="solution-billing-5-customer">
              Customer
            </FieldLabel>
            <Combobox
              items={INVOICE_CUSTOMERS}
              value={selectedCustomer}
              onValueChange={(customer) =>
                onCustomerChange(customer as InvoiceCustomer | null)
              }
              itemToStringLabel={(customer) => customer.name}
              itemToStringValue={(customer) => customer.name}
            >
              <ComboboxInput
                id="solution-billing-5-customer"
                placeholder="Find a customer account..."
                className="w-full"
                aria-invalid={hasCustomerError || undefined}
                showClear
              />
              <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
                <ComboboxEmpty>No customers found.</ComboboxEmpty>
                <ComboboxList>
                  {(customer) => (
                    <ComboboxItem key={customer.id} value={customer}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{customer.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {customer.accountId} · {customer.plan}
                        </span>
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>

          <Field>
            <FieldLabel htmlFor="solution-billing-5-tax-id">Tax ID</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Building2Icon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="solution-billing-5-tax-id"
                value={selectedCustomer?.taxId ?? ""}
                placeholder="Select a customer first"
                readOnly
              />
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="solution-billing-5-invoice-number">
              Invoice Number
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <HashIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="solution-billing-5-invoice-number"
                defaultValue={invoiceNumber}
              />
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="solution-billing-5-po-number">
              PO Reference
            </FieldLabel>
            <Input
              id="solution-billing-5-po-number"
              defaultValue={DEFAULT_INVOICE_FORM_VALUES.poNumber}
            />
          </Field>
        </FieldGroup>
      </InvoiceSection>

      <Separator />

      <InvoiceSection
        title="Terms"
        description="Dates, currency, and collection method."
        badge={getOptionLabel(PAYMENT_TERMS_OPTIONS, paymentTerms)}
        badgeVariant="info-light"
      >
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="solution-billing-5-issue-date">
              Issue Date
            </FieldLabel>
            <InvoiceDateField
              id="solution-billing-5-issue-date"
              label="Choose issue date"
              date={issueDate}
              onSelect={onIssueDateChange}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="solution-billing-5-due-date">
              Due Date
            </FieldLabel>
            <InvoiceDateField
              id="solution-billing-5-due-date"
              label="Choose due date"
              date={dueDate}
              onSelect={onDueDateChange}
            />
          </Field>

          <InvoiceSelectField
            id="solution-billing-5-currency"
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onValueChange={onCurrencyChange}
          />

          <InvoiceSelectField
            id="solution-billing-5-payment-terms"
            label="Payment Terms"
            value={paymentTerms}
            options={PAYMENT_TERMS_OPTIONS}
            onValueChange={onPaymentTermsChange}
          />

          <InvoiceSelectField
            id="solution-billing-5-collection-method"
            label="Collection"
            value={collectionMethod}
            options={COLLECTION_METHOD_OPTIONS}
            onValueChange={onCollectionMethodChange}
          />

          <Field>
            <FieldLabel htmlFor="solution-billing-5-billing-address">
              Billing Address
            </FieldLabel>
            <Input
              id="solution-billing-5-billing-address"
              value={selectedCustomer?.billingAddress ?? ""}
              placeholder="Select a customer first"
              readOnly
            />
          </Field>
        </FieldGroup>
      </InvoiceSection>
    </>
  )
}

function InvoiceLineItems({
  items,
  onProductChange,
  onQuantityChange,
  onUnitPriceChange,
  onTaxRateChange,
  onRemoveItem,
  currency,
}: {
  items: InvoiceLineItem[]
  currency: string
  onProductChange: (id: string, productId: string) => void
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onTaxRateChange: (id: string, taxRate: string) => void
  onRemoveItem: (id: string) => void
}) {
  return (
    <div className="min-w-0">
      <Table aria-label="Invoice line items" className="w-full table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[38%]">Item</TableHead>
            <TableHead className="w-16">Qty</TableHead>
            <TableHead className="w-24">Rate</TableHead>
            <TableHead className="w-24">Tax</TableHead>
            <TableHead className="w-24 text-right">Amount</TableHead>
            <TableHead className="w-9" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const product =
              PRODUCT_BY_ID.get(item.productId) ?? INVOICE_PRODUCTS[0]

            return (
              <TableRow key={item.id}>
                <TableCell className="align-middle">
                  <Select
                    value={item.productId}
                    onValueChange={(value) =>
                      value && onProductChange(item.id, value)
                    }
                  >
                    <SelectTrigger
                      aria-label={`Item for ${item.id}`}
                      className="w-full min-w-0"
                    >
                      <SelectValue>{product.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      alignItemWithTrigger={false}
                      className="w-(--anchor-width)"
                    >
                      <SelectGroup>
                        {INVOICE_PRODUCTS.map((productOption) => (
                          <SelectItem
                            key={productOption.id}
                            value={productOption.id}
                          >
                            {productOption.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="align-middle">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    aria-label={`Quantity for ${product.name}`}
                    className="w-full min-w-0"
                    onChange={(event) =>
                      onQuantityChange(item.id, Number(event.target.value) || 1)
                    }
                  />
                </TableCell>
                <TableCell className="align-middle">
                  <InputGroup className="w-full min-w-0">
                    <InputGroupAddon>$</InputGroupAddon>
                    <InputGroupInput
                      type="number"
                      min={0}
                      step={1}
                      value={item.unitPrice}
                      aria-label={`Rate for ${product.name}`}
                      onChange={(event) =>
                        onUnitPriceChange(
                          item.id,
                          Number(event.target.value) || 0
                        )
                      }
                    />
                  </InputGroup>
                </TableCell>
                <TableCell className="align-middle">
                  <Select
                    value={item.taxRate}
                    onValueChange={(value) =>
                      value && onTaxRateChange(item.id, value)
                    }
                  >
                    <SelectTrigger
                      aria-label={`Tax rate for ${product.name}`}
                      className="w-full min-w-0"
                    >
                      <SelectValue>
                        {TAX_RATE_OPTIONS.find(
                          (option) => option.value === item.taxRate
                        )?.label ?? item.taxRate}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
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
                    {formatCurrency(getLineSubtotal(item), currency)}
                  </span>
                </TableCell>
                <TableCell className="align-middle">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${product.name}`}
                    disabled={items.length === 1}
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function LineItemsStep({
  lineItems,
  currency,
  subtotal,
  onAddLineItem,
  onProductChange,
  onQuantityChange,
  onUnitPriceChange,
  onTaxRateChange,
  onRemoveLineItem,
}: {
  lineItems: InvoiceLineItem[]
  currency: string
  subtotal: number
  onAddLineItem: () => void
  onProductChange: (id: string, productId: string) => void
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onTaxRateChange: (id: string, taxRate: string) => void
  onRemoveLineItem: (id: string) => void
}) {
  return (
    <InvoiceSection
      title="Line Items"
      description="Seats, usage, storage, and support add-ons."
      badge={`${lineItems.length} item${lineItems.length === 1 ? "" : "s"}`}
      badgeVariant="secondary"
    >
      <InvoiceLineItems
        items={lineItems}
        currency={currency}
        onProductChange={onProductChange}
        onQuantityChange={onQuantityChange}
        onUnitPriceChange={onUnitPriceChange}
        onTaxRateChange={onTaxRateChange}
        onRemoveItem={onRemoveLineItem}
      />

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onAddLineItem}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Add item
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          Subtotal {formatCurrency(subtotal, currency)}
        </span>
      </div>
    </InvoiceSection>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "text-foreground font-medium" : undefined}>
        {label}
      </dt>
      <dd
        className={
          strong
            ? "text-foreground text-base font-semibold tabular-nums"
            : "text-foreground tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  )
}

function TaxStep({
  currency,
  discountPercent,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  onDiscountChange,
}: {
  currency: string
  discountPercent: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  onDiscountChange: (value: number) => void
}) {
  return (
    <InvoiceSection
      title="Tax And Discount"
      description="Set the discount and confirm per-line tax."
      badge={formatCurrency(total, currency)}
      badgeVariant="success-light"
    >
      <div className="bg-background relative isolate overflow-hidden rounded-md border p-4 shadow-xs">
        <div className="relative flex flex-col gap-4">
          <Field className="w-full sm:ml-auto sm:w-44">
            <FieldLabel htmlFor="solution-billing-5-discount">
              Invoice Discount
            </FieldLabel>
            <InputGroup className="bg-background">
              <InputGroupInput
                id="solution-billing-5-discount"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPercent}
                aria-label="Invoice discount percentage"
                onChange={(event) =>
                  onDiscountChange(Number(event.target.value) || 0)
                }
              />
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
          </Field>

          <dl className="bg-muted/30 grid gap-2.5 rounded-md border p-3 text-sm">
            <SummaryRow
              label="Subtotal"
              value={formatCurrency(subtotal, currency)}
            />
            <SummaryRow
              label={`Discount (${discountPercent}%)`}
              value={`-${formatCurrency(discountAmount, currency)}`}
            />
            <SummaryRow
              label="Tax"
              value={formatCurrency(taxAmount, currency)}
            />
            <SummaryRow
              label="Total Due"
              value={formatCurrency(total, currency)}
              strong
            />
          </dl>
        </div>
      </div>
    </InvoiceSection>
  )
}

// Receipt-style totals row, adapted from ecommerce/receipt/receipt-6.
function TotalRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string
  value: string
  tone?: "default" | "success"
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={cn(
          strong
            ? "text-foreground text-base font-semibold"
            : "text-muted-foreground text-sm"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong
            ? "text-foreground text-lg font-bold"
            : "text-foreground text-sm font-medium",
          tone === "success" && "text-success"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

// Receipt-style detail cell, adapted from ecommerce/receipt/receipt-6.
function DetailBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-muted-foreground text-[0.625rem] font-semibold tracking-[0.22em] uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

// The signature: a live receipt-style invoice preview on the final step. The
// two-Card sectional rhythm and totals dl come from ecommerce/receipt/receipt-6;
// the line rows, tax, discount, and total reconcile against the line table.
function ReviewStep({
  customer,
  invoiceNumber,
  poNumber,
  issueDate,
  dueDate,
  lineItems,
  currency,
  discountPercent,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paymentTerms,
  collectionMethod,
  isSent,
}: {
  customer: InvoiceCustomer
  invoiceNumber: string
  poNumber: string
  issueDate: Date
  dueDate: Date
  lineItems: InvoiceLineItem[]
  currency: string
  discountPercent: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  paymentTerms: string
  collectionMethod: string
  isSent: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {isSent ? (
        <Alert variant="success">
          <CircleCheckIcon className="size-4" aria-hidden="true" />
          <AlertTitle>Invoice sent</AlertTitle>
          <AlertDescription>
            <p>
              {invoiceNumber} for {formatCurrency(total, currency)} was emailed
              to {customer.email}.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Order summary Card: header + items + totals (receipt-6 grammar) */}
      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-8">
            <div className="flex min-w-0 flex-col gap-2">
              {isSent ? (
                <Badge variant="success" radius="full" className="w-fit">
                  <CircleCheckIcon className="size-3.5" aria-hidden="true" />
                  Sent
                </Badge>
              ) : (
                <Badge variant="info-light" radius="full" className="w-fit">
                  <ReceiptIcon className="size-3.5" aria-hidden="true" />
                  Draft
                </Badge>
              )}
              <CardTitle className="text-xl tracking-tight">
                Invoice {invoiceNumber}
              </CardTitle>
              <CardDescription className="leading-relaxed">
                Billed to{" "}
                <span className="text-foreground font-medium">
                  {customer.name}
                </span>{" "}
                · {customer.email}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-1 md:items-end">
              <span className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
                Total Due
              </span>
              <span className="text-foreground text-2xl leading-none font-bold tracking-tight tabular-nums">
                {formatCurrency(total, currency)}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                Due {formatDate(dueDate)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col divide-y">
          {lineItems.map((item, index) => {
            const product =
              PRODUCT_BY_ID.get(item.productId) ?? INVOICE_PRODUCTS[0]
            const isFirst = index === 0
            const isLast = index === lineItems.length - 1

            return (
              <article
                key={item.id}
                className={cn(
                  "flex min-w-0 items-start gap-4",
                  isFirst ? "pt-0" : "pt-4",
                  isLast ? "pb-0" : "pb-4"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3 className="text-foreground min-w-0 truncate text-sm leading-snug font-semibold">
                    {product.name}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {item.quantity} × {formatCurrency(item.unitPrice, currency)}
                    {Number(item.taxRate) > 0
                      ? ` · ${item.taxRate}% tax`
                      : " · No tax"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm tabular-nums">
                  <span className="text-foreground font-semibold">
                    {formatCurrency(getLineSubtotal(item), currency)}
                  </span>
                </div>
              </article>
            )
          })}
        </CardContent>

        <CardFooter className="border-t pt-5">
          <dl className="ml-auto flex w-full flex-col gap-1.5 text-sm sm:w-72">
            <TotalRow
              label="Subtotal"
              value={formatCurrency(subtotal, currency)}
            />
            {discountPercent > 0 ? (
              <TotalRow
                label={`Discount (${discountPercent}%)`}
                value={`-${formatCurrency(discountAmount, currency)}`}
                tone="success"
              />
            ) : null}
            <TotalRow label="Tax" value={formatCurrency(taxAmount, currency)} />
            <Separator className="my-1" />
            <TotalRow
              label="Total Due"
              value={formatCurrency(total, currency)}
              strong
            />
          </dl>
        </CardFooter>
      </Card>

      {/* Details Card: bill-to, terms, collection (receipt-6 3-up grid) */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
          <DetailBlock label="Bill To">
            <address className="text-foreground text-sm leading-snug not-italic">
              <p className="font-medium">{customer.name}</p>
              <p className="text-muted-foreground text-xs">
                {customer.accountId} · {customer.plan}
              </p>
              <p className="text-muted-foreground text-xs">
                {customer.billingAddress}
              </p>
              <p className="text-muted-foreground text-xs">{customer.taxId}</p>
            </address>
          </DetailBlock>

          <DetailBlock label="Terms">
            <p className="text-foreground text-sm font-medium">
              {getOptionLabel(PAYMENT_TERMS_OPTIONS, paymentTerms)}
            </p>
            <p className="text-muted-foreground text-xs">
              Issued {formatDate(issueDate)}
            </p>
            <p className="text-muted-foreground text-xs">
              Due {formatDate(dueDate)}
            </p>
          </DetailBlock>

          <DetailBlock label="Collection">
            <p className="text-foreground text-sm font-medium">
              {getOptionLabel(COLLECTION_METHOD_OPTIONS, collectionMethod)}
            </p>
            <p className="text-muted-foreground text-xs">
              PO {poNumber} · {currency.toUpperCase()}
            </p>
            <div className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs">
              <Avatar className="size-4">
                <AvatarImage src={INVOICE_PREPARER.avatar} alt="" />
                <AvatarFallback className="text-[9px] font-medium">
                  {INVOICE_PREPARER.monogram}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                Prepared by {INVOICE_PREPARER.name}
              </span>
            </div>
          </DetailBlock>
        </CardContent>
      </Card>
    </div>
  )
}

export function InvoiceBuilderWizard() {
  const nextLineId = useRef(DEFAULT_INVOICE_LINES.length + 1)
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [showCustomerError, setShowCustomerError] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<InvoiceCustomer | null>(
      () =>
        INVOICE_CUSTOMERS.find(
          (customer) => customer.id === DEFAULT_INVOICE_FORM_VALUES.customerId
        ) ?? null
    )
  const [lineItems, setLineItems] = useState(() => DEFAULT_INVOICE_LINES)
  const [issueDate, setIssueDate] = useState(
    () => new Date(DEFAULT_INVOICE_FORM_VALUES.issueDate)
  )
  const [dueDate, setDueDate] = useState(
    () => new Date(DEFAULT_INVOICE_FORM_VALUES.dueDate)
  )
  const [currency, setCurrency] = useState<string>(
    DEFAULT_INVOICE_FORM_VALUES.currency
  )
  const [paymentTerms, setPaymentTerms] = useState<string>(
    DEFAULT_INVOICE_FORM_VALUES.paymentTerms
  )
  const [collectionMethod, setCollectionMethod] = useState<string>(
    DEFAULT_INVOICE_FORM_VALUES.collectionMethod
  )
  const [discountPercent, setDiscountPercent] = useState<number>(
    DEFAULT_INVOICE_FORM_VALUES.discountPercent
  )

  const invoiceNumber = DEFAULT_INVOICE_FORM_VALUES.invoiceNumber
  const currentStepConfig = WIZARD_STEPS[currentStep - 1]
  const subtotal = lineItems.reduce(
    (running, line) => running + getLineSubtotal(line),
    0
  )
  const discountAmount = subtotal * (discountPercent / 100)
  const taxAmount = lineItems.reduce(
    (running, line) => running + getLineTax(line),
    0
  )
  const total = Math.max(subtotal - discountAmount + taxAmount, 0)
  const isFinalStep = currentStep === WIZARD_STEPS.length

  function goToStep(step: number) {
    setCurrentStep(Math.min(Math.max(step, 1), WIZARD_STEPS.length))
  }

  function handleCustomerChange(customer: InvoiceCustomer | null) {
    setSelectedCustomer(customer)
    if (customer) {
      setShowCustomerError(false)
    }
  }

  function handleAddLineItem() {
    const id = `line-${nextLineId.current}`
    nextLineId.current += 1

    setLineItems((items) => [...items, createInvoiceLine(id)])
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((items) =>
      items.length === 1 ? items : items.filter((item) => item.id !== id)
    )
  }

  function handleProductChange(id: string, productId: string) {
    const product = PRODUCT_BY_ID.get(productId) ?? INVOICE_PRODUCTS[0]

    setLineItems((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              productId,
              unitPrice: product.unitPrice,
              taxRate: product.taxRate,
            }
          : item
      )
    )
  }

  function updateLineItem(
    id: string,
    updates: Partial<
      Pick<InvoiceLineItem, "quantity" | "unitPrice" | "taxRate">
    >
  ) {
    setLineItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  function handleSaveDraft() {
    showInvoiceToast(
      "Draft saved",
      `${invoiceNumber} stored with ${lineItems.length} line items at ${formatCurrency(total, currency)}.`
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Validation gate on the first step: a customer is required before the
    // operator can build line items.
    if (currentStepConfig.id === "customer" && !selectedCustomer) {
      setShowCustomerError(true)
      return
    }

    if (!isFinalStep) {
      goToStep(currentStep + 1)
      return
    }

    if (isSubmitting || isSent) {
      return
    }

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      setIsSent(true)
      showInvoiceToast(
        "Invoice sent",
        `${invoiceNumber} for ${formatCurrency(total, currency)} emailed to ${
          selectedCustomer?.email ?? "the customer"
        }.`
      )
    }, 900)
  }

  return (
    <div className="bg-background flex min-h-svh w-full flex-col">
      <div className="mx-auto flex w-full max-w-[1320px] justify-center p-3 md:p-4">
        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className={cn("w-full", CONTENT_MAX_WIDTH_CLASS)}
          aria-label="Invoice builder wizard"
        >
          <Card className="w-full gap-0 p-0">
            <Stepper value={currentStep} onValueChange={goToStep}>
              <CardHeader className="gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-6">
                <CardTitle className="leading-5">New Invoice</CardTitle>
                <CardDescription className="max-w-[34rem] leading-5">
                  {currentStepConfig.description}
                </CardDescription>
                <CardAction className="self-center pl-3">
                  <InvoiceHeaderSummary
                    status={isSent ? "Sent" : "Draft"}
                    isSent={isSent}
                    invoiceNumber={invoiceNumber}
                  />
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6">
                <div
                  data-stepper-scroll
                  className="overflow-x-auto overflow-y-hidden py-4"
                >
                  <InvoiceStepNav steps={WIZARD_STEPS} />
                </div>

                <FieldSet className="gap-0">
                  <FieldLegend className="sr-only">
                    Invoice builder wizard
                  </FieldLegend>
                  <FieldDescription className="sr-only">
                    Build an invoice with customer, line items, tax and
                    discount, then review and send.
                  </FieldDescription>

                  <StepperPanel>
                    {WIZARD_STEPS.map((step) => (
                      <StepperContent
                        key={step.id}
                        value={step.value}
                        className="w-full"
                      >
                        <div className="flex min-w-0 flex-col gap-7">
                          {step.id === "customer" ? (
                            <CustomerStep
                              selectedCustomer={selectedCustomer}
                              invoiceNumber={invoiceNumber}
                              issueDate={issueDate}
                              dueDate={dueDate}
                              currency={currency}
                              paymentTerms={paymentTerms}
                              collectionMethod={collectionMethod}
                              hasCustomerError={showCustomerError}
                              onCustomerChange={handleCustomerChange}
                              onIssueDateChange={setIssueDate}
                              onDueDateChange={setDueDate}
                              onCurrencyChange={setCurrency}
                              onPaymentTermsChange={setPaymentTerms}
                              onCollectionMethodChange={setCollectionMethod}
                            />
                          ) : null}

                          {step.id === "items" ? (
                            <LineItemsStep
                              lineItems={lineItems}
                              currency={currency}
                              subtotal={subtotal}
                              onAddLineItem={handleAddLineItem}
                              onProductChange={handleProductChange}
                              onQuantityChange={(id, quantity) =>
                                updateLineItem(id, {
                                  quantity: Math.max(quantity, 1),
                                })
                              }
                              onUnitPriceChange={(id, unitPrice) =>
                                updateLineItem(id, {
                                  unitPrice: Math.max(unitPrice, 0),
                                })
                              }
                              onTaxRateChange={(id, taxRate) =>
                                updateLineItem(id, { taxRate })
                              }
                              onRemoveLineItem={handleRemoveLineItem}
                            />
                          ) : null}

                          {step.id === "tax" ? (
                            <TaxStep
                              currency={currency}
                              discountPercent={discountPercent}
                              subtotal={subtotal}
                              discountAmount={discountAmount}
                              taxAmount={taxAmount}
                              total={total}
                              onDiscountChange={(value) =>
                                setDiscountPercent(clampPercent(value))
                              }
                            />
                          ) : null}

                          {step.id === "review" && selectedCustomer ? (
                            <ReviewStep
                              customer={selectedCustomer}
                              invoiceNumber={invoiceNumber}
                              poNumber={DEFAULT_INVOICE_FORM_VALUES.poNumber}
                              issueDate={issueDate}
                              dueDate={dueDate}
                              lineItems={lineItems}
                              currency={currency}
                              discountPercent={discountPercent}
                              subtotal={subtotal}
                              discountAmount={discountAmount}
                              taxAmount={taxAmount}
                              total={total}
                              paymentTerms={paymentTerms}
                              collectionMethod={collectionMethod}
                              isSent={isSent}
                            />
                          ) : null}
                        </div>
                      </StepperContent>
                    ))}
                  </StepperPanel>
                </FieldSet>
              </CardContent>

              <CardFooter className="justify-between gap-3 border-t px-5 py-4 sm:px-6">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => goToStep(currentStep - 1)}
                  >
                    <ArrowLeftIcon className="size-4" aria-hidden="true" />
                    Previous
                  </Button>
                ) : (
                  <span
                    className="hidden h-9 w-28 sm:block"
                    aria-hidden="true"
                  />
                )}

                <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="hidden sm:inline-flex"
                    disabled={isSubmitting || isSent}
                    onClick={handleSaveDraft}
                  >
                    Save draft
                  </Button>

                  <Button
                    type="submit"
                    className="min-w-0 px-3 sm:min-w-32 sm:px-4"
                    disabled={isSubmitting || isSent}
                  >
                    {isSubmitting ? (
                      <Spinner data-icon="inline-start" aria-hidden="true" />
                    ) : null}
                    {isSent
                      ? "Invoice sent"
                      : isFinalStep
                        ? "Send invoice"
                        : "Next step"}
                    {!isSubmitting && !isSent ? (
                      isFinalStep ? (
                        <SendIcon aria-hidden="true" data-icon="inline-end" />
                      ) : (
                        <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                      )
                    ) : null}
                  </Button>
                </div>
              </CardFooter>
            </Stepper>
          </Card>
        </form>
      </div>
    </div>
  )
}