import type { ListFilter, ListFilterSpec } from './listFilter'
import { z } from 'zod'
import type { Money } from './money'
import type { PaymentStatus } from './payment'
import type { TenantAddress } from './tenant'

/**
 * What an invoice *is*, to this product.
 *
 * The API's `InvoiceResponse` carries ~45 fields, every one of them optional,
 * and three separate notions of "status":
 *
 *   status         the entity lifecycle: published, deleted
 *   invoiceStatus  DRAFT | FINALIZED | VOIDED | SKIPPED
 *   paymentStatus  PENDING | SUCCEEDED | FAILED | PARTIALLY_REFUNDED | ...
 *
 * A grid cell cannot reasonably be asked to know which of the three it means,
 * nor to write `invoice.amountDue ?? '0'` in every column. So the domain model
 * is narrow and total: the fields a screen actually uses, none of them
 * optional unless genuinely absent, money as `Money`, and **one** status.
 *
 * This is the layer where Flexprice's vocabulary becomes the product's.
 */
export interface Invoice {
  id: string
  /** Human-facing number. Empty when the API has not issued one. */
  number: string
  customerId: string
  /** Display name, already resolved. The UI never joins data. */
  customerName: string
  /** The contract that raised it; absent for one-off invoices and older reads. */
  subscriptionId?: string | null
  status: InvoiceStatus
  /**
   * What the *money* did, as opposed to what the document did.
   *
   * {@link Invoice.status} already folds the API's two status fields into the
   * one question a billing operator asks, and that fold is lossy on purpose:
   * a finalized invoice whose only payment attempt failed and one nobody has
   * tried to collect are both `open`. The first needs chasing today. So the
   * payment side is also carried through unfolded, and the list shows both:
   * one column for the document, one for the collection.
   *
   * `null` when the API sends no payment status, or sends one this build does
   * not recognise. Never inferred from the balance: "we were not told" and
   * "nothing has been attempted" are different facts.
   */
  paymentStatus: PaymentStatus | null
  total: Money
  amountDue: Money
  amountRemaining: Money
  /** Absent on drafts. */
  dueDate: Date | null
  issuedAt: Date | null
  periodStart: Date | null
  periodEnd: Date | null
}

/**
 * The status a person actually cares about.
 *
 * Collapses the API's two status fields into the one question a billing
 * operator is asking: does this need my attention, and why?
 *
 * Note `overdue`, which the API does not have. It is `finalized` plus an unpaid
 * balance plus a due date in the past: a derivation every screen would
 * otherwise reinvent slightly differently. Deriving it once, here, is the
 * difference between a product vocabulary and a transport dump.
 */
export const InvoiceStatus = {
  Draft: 'draft',
  Open: 'open',
  Paid: 'paid',
  Overdue: 'overdue',
  Void: 'void',
  Skipped: 'skipped',
} as const

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

/** What stands in for a draft's invoice number, which is assigned when it is finalized. */
export const DRAFT_INVOICE_NUMBER_LABEL = 'To be generated'

/**
 * Inputs to {@link deriveInvoiceStatus}, structurally typed.
 *
 * Deliberately not the SDK's `InvoiceResponse`: domain may not import
 * transport types, and ESLint enforces it. Describing only what the derivation
 * reads also makes it testable without constructing a 45-field object.
 */
export interface InvoiceStatusInput {
  invoiceStatus: string | null | undefined
  paymentStatus: string | null | undefined
  dueDate: Date | null | undefined
  /** True when money is still owed. */
  hasOutstandingBalance: boolean
  /** Injected so "overdue" is testable without freezing the clock. */
  now?: Date
}

/**
 * Whether a due date has passed, by calendar day in UTC: due on the 26th is
 * payable through the 26th and overdue from the 27th, the day the invoice PDF
 * prints. The one rule the console and the hosted invoice page both use.
 */
export function isPastDue(dueDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!dueDate) return false
  const day = (value: Date) =>
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  return day(now) > day(dueDate)
}

export function deriveInvoiceStatus({
  invoiceStatus,
  paymentStatus,
  dueDate,
  hasOutstandingBalance,
  now = new Date(),
}: InvoiceStatusInput): InvoiceStatus {
  // Voided and skipped are terminal and outrank anything the payment says.
  if (invoiceStatus === 'VOIDED') return InvoiceStatus.Void
  if (invoiceStatus === 'SKIPPED') return InvoiceStatus.Skipped
  if (invoiceStatus === 'DRAFT') return InvoiceStatus.Draft

  if (paymentStatus === 'SUCCEEDED' || !hasOutstandingBalance) return InvoiceStatus.Paid

  // Overdue is the whole reason this function exists: it is not a field.
  if (isPastDue(dueDate, now)) return InvoiceStatus.Overdue

  return InvoiceStatus.Open
}

/** Statuses that should pull a billing operator's eye. */
/**
 * The statuses the API actually stores, as opposed to the ones this module
 * works out for itself.
 *
 * `deriveInvoiceStatus` above computes `Paid` from a payment status and
 * `Overdue` from a due date: neither is a field on an invoice, so neither can
 * be asked of the API. That distinction is not transport trivia: it is the
 * reason the function exists, and anything offering the reader a status to
 * *filter* by has to respect it.
 *
 * Offering a derived status as a filter is worse than omitting it. The request
 * carries no status at all, the API answers with every invoice, and the screen
 * shows an unfiltered list under a chip insisting it is filtered: a wrong
 * answer presented as a right one.
 */
export const STORED_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.Draft,
  InvoiceStatus.Open,
  InvoiceStatus.Void,
  InvoiceStatus.Skipped,
]

/** True when the API can be asked for this status directly. */
export function isStoredInvoiceStatus(status: InvoiceStatus): boolean {
  return STORED_INVOICE_STATUSES.includes(status)
}

export function needsAttention(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Overdue
}

/**
 * What the user is asking for: which invoices, in what order, on which page.
 *
 * Lives in the domain because it is product vocabulary, not transport: it says
 * `sort: 'total'`, not `sort: [{ field: 'amount_due', direction: 'desc' }]`.
 * `@fp/query` translates it into an `InvoiceFilter`.
 *
 * It also has to survive a URL round-trip, because the page keeps this in
 * search params rather than in component state.
 */
export interface InvoiceQuery {
  page: number
  pageSize: number
  sortBy: InvoiceSortField
  sortDirection: 'asc' | 'desc'
  /** Empty means no filter, not "match nothing". */
  statuses: InvoiceStatus[]
  search: string
  /** Granular field filters, applied by the search endpoint. See `INVOICE_FILTERS`. */
  filters?: ListFilter[]
}

export const InvoiceSortField = {
  UpdatedAt: 'updatedAt',
  IssuedAt: 'issuedAt',
  DueDate: 'dueDate',
  Total: 'total',
  Status: 'status',
} as const

export type InvoiceSortField = (typeof InvoiceSortField)[keyof typeof InvoiceSortField]

export const DEFAULT_INVOICE_QUERY: InvoiceQuery = {
  page: 1,
  pageSize: 25,
  sortBy: InvoiceSortField.UpdatedAt,
  sortDirection: 'desc',
  statuses: [],
  search: '',
  filters: [],
}
/**
 * What the invoice list can filter on: V1's fields, by their wire names.
 * Customer choices are the account's own records; the page fills them in.
 */
export const INVOICE_FILTERS: readonly ListFilterSpec[] = [
  { field: 'invoice_number', label: 'Invoice number', kind: 'text' },
  { field: 'customer_id', label: 'Customer', kind: 'options', options: [] },
  {
    field: 'invoice_status',
    label: 'Invoice status',
    kind: 'options',
    options: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'FINALIZED', label: 'Finalized' },
      { value: 'VOIDED', label: 'Voided' },
      { value: 'SKIPPED', label: 'Skipped' },
    ],
  },
  {
    field: 'payment_status',
    label: 'Payment status',
    kind: 'options',
    options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'PROCESSING', label: 'Processing' },
      { value: 'SUCCEEDED', label: 'Succeeded' },
      { value: 'FAILED', label: 'Failed' },
      { value: 'OVERPAID', label: 'Overpaid' },
      { value: 'REFUNDED', label: 'Refunded' },
      { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
    ],
  },
  {
    field: 'invoice_type',
    label: 'Invoice type',
    kind: 'options',
    options: [
      { value: 'SUBSCRIPTION', label: 'Subscription' },
      { value: 'ONE_OFF', label: 'One-off' },
      { value: 'CREDIT', label: 'Credit' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
  { field: 'due_date', label: 'Due date', kind: 'date' },
]

/** One line of an invoice, as the detail page shows it. Amounts stay exact strings. */
export interface InvoiceDetailLine {
  id: string
  /** The price that produced this line; empty when the API did not say. */
  priceId?: string
  description: string
  /** The period or unit note under the description, when the API sent one. */
  detail: string
  quantity: string
  amount: string
  /** How the line is priced: metered usage or a fixed charge. `null` when the API does not say. */
  priceType: InvoiceLinePriceType | null
  /** The free-text note on the line (`metadata.description`), which the PDF prints. */
  note?: string
  /** The service period the line covers, when it has one. */
  periodStart?: Date | null
  periodEnd?: Date | null
}

export const InvoiceLinePriceType = {
  Usage: 'usage',
  Fixed: 'fixed',
} as const
export type InvoiceLinePriceType = (typeof InvoiceLinePriceType)[keyof typeof InvoiceLinePriceType]

/**
 * The detail read model: the list row plus what the document page adds.
 *
 * Every figure is what the API computed. Nothing here is summed or derived, so
 * the page cannot disagree with the invoice the customer receives.
 */
export interface InvoiceDetail extends Invoice {
  currency: string
  customerEmail: string
  /** The customer's billing address as the invoice carries it. Empty fields are `''`. */
  customerAddress: TenantAddress
  /** The issuing tenant, for the "Bill from" block. */
  tenantId: string
  metadata: Readonly<Record<string, string>>
  description: string
  subscriptionId: string | null
  invoicePdfUrl: string | null
  subtotal: string
  tax: string
  prepaidCredits: string
  /** Coupons and line discounts taken off the subtotal (`total_discount`), as a positive decimal. */
  discount: string
  amountPaid: string
  lines: InvoiceDetailLine[]
  finalizedAt: Date | null
  paidAt: Date | null
  voidedAt: Date | null
  createdAt: Date | null
}

/**
 * How an invoice can be recalculated, or why it cannot. Two endpoints exist:
 * a draft is recalculated in place (`recalculate-v2`); a voided contract
 * invoice is replaced by a fresh one for the same period (`recalculate`, an
 * async workflow). An unpaid finalized contract invoice gets there by being
 * voided first, which the person confirms.
 */
export type InvoiceRecalculation =
  | { kind: 'in-place' }
  | { kind: 'replace' }
  | { kind: 'void-and-replace' }
  | { kind: 'unavailable'; reason: string }

export function invoiceRecalculation(
  invoice: Pick<InvoiceDetail, 'status' | 'subscriptionId' | 'amountPaid'>,
): InvoiceRecalculation {
  if (invoice.status === InvoiceStatus.Draft) return { kind: 'in-place' }
  if (!invoice.subscriptionId)
    return { kind: 'unavailable', reason: 'Only contract invoices can be recalculated' }
  if (invoice.status === InvoiceStatus.Void) return { kind: 'replace' }
  if (invoice.status === InvoiceStatus.Skipped)
    return { kind: 'unavailable', reason: 'A skipped invoice has nothing to recalculate' }
  const paidSomething = /[1-9]/.test(invoice.amountPaid)
  if (
    (invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue) &&
    !paidSomething
  )
    return { kind: 'void-and-replace' }
  return {
    kind: 'unavailable',
    reason: 'A paid invoice cannot be voided; issue a credit memo instead',
  }
}

const LINE_AMOUNT = /^(\d+)(?:\.(\d{1,8}))?$/

/**
 * Sums the amounts a person typed on a one-off invoice, exactly.
 *
 * This is not money arithmetic in the sense `money.ts` rules out: the numbers
 * are the author's own line amounts, not a tax, proration or discount the
 * backend owns, and the sum is done on integers (scaled by 10^8, the schema's
 * precision) so no float ever touches it. Returns `null` while any amount is
 * blank or malformed, so a half-typed form shows no total instead of a wrong one.
 */
export function sumLineAmounts(amounts: readonly string[]): string | null {
  const SCALE = 8
  let total = 0n
  for (const raw of amounts) {
    const match = LINE_AMOUNT.exec(raw.trim())
    if (!match) return null
    total += BigInt(match[1]!) * 10n ** BigInt(SCALE) + BigInt((match[2] ?? '').padEnd(SCALE, '0'))
  }
  const digits = total.toString().padStart(SCALE + 1, '0')
  const whole = digits.slice(0, -SCALE)
  const fraction = digits.slice(-SCALE).replace(/0+$/, '').padEnd(2, '0')
  return `${whole}.${fraction}`
}

/** A day as `YYYY-MM-DD`, or blank. */
const optionalDay = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Pick a date')

/** A tax rate applied to a new invoice: `tax_rate_overrides`, as V1 prefills them from the customer. */
export interface InvoiceTax {
  taxRateCode: string
  /** For display: the rate's name and percentage. */
  name: string
  percentage: string
  taxBehavior: 'exclusive' | 'inclusive'
  priority: number
  autoApply: boolean
}

/**
 * A manual (one-off) invoice, as V1 raises it: issue and due dates, currency,
 * lines (name, quantity, amount, a note and a service period), the customer's
 * taxes, a memo and metadata.
 *
 * The API requires `subtotal`, `total` and `amount_due`, so the form sends the
 * exact sum of the lines ({@link sumLineAmounts}): the total is derived from
 * the line items, never typed separately, so the two cannot disagree. Taxes are
 * applied by Flexprice on top of that from the rates sent.
 */
export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  currency: z.string().trim().length(3, 'Choose a currency'),
  /** Optional: Flexprice numbers the invoice when left blank. */
  invoiceNumber: z.string().trim().max(100, 'Keep the number under 100 characters'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
  /** `YYYY-MM-DD`; blank means today. */
  issueDate: optionalDay,
  /** `YYYY-MM-DD`, or empty for no due date. */
  dueDate: optionalDay,
  total: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, 'Enter an amount like 120 or 120.50'),
  /** Finalize on creation instead of leaving a draft. */
  finalize: z.boolean(),
  metadata: z.record(z.string(), z.string()),
  taxes: z.array(
    z.object({
      taxRateCode: z.string().min(1),
      name: z.string(),
      percentage: z.string(),
      taxBehavior: z.enum(['exclusive', 'inclusive']),
      priority: z.number().int(),
      autoApply: z.boolean(),
    }),
  ),
  lines: z
    .array(
      z
        .object({
          description: z.string().trim().min(1, 'Name the line'),
          quantity: z
            .string()
            .trim()
            .regex(/^\d+(\.\d+)?$/, 'Enter a quantity'),
          /** The line total: quantity × unit price. */
          amount: z
            .string()
            .trim()
            .regex(/^\d+(\.\d{1,8})?$/, 'Enter an amount'),
          /** Printed under the line on the PDF. */
          note: z.string().trim().max(500, 'Keep the note under 500 characters'),
          periodStart: optionalDay,
          periodEnd: optionalDay,
        })
        .refine(
          (line) => !line.periodStart || !line.periodEnd || line.periodEnd >= line.periodStart,
          { message: 'The period ends before it starts', path: ['periodEnd'] },
        ),
    )
    .min(1, 'Add at least one line'),
})

export type CreateInvoice = z.infer<typeof createInvoiceSchema>

export function emptyInvoice(): CreateInvoice {
  return {
    customerId: '',
    currency: '',
    invoiceNumber: '',
    description: '',
    issueDate: '',
    dueDate: '',
    total: '',
    finalize: false,
    metadata: {},
    taxes: [],
    lines: [
      { description: '', quantity: '1', amount: '', note: '', periodStart: '', periodEnd: '' },
    ],
  }
}
