import type { Money } from './money'

/**
 * What an invoice *is*, to this product.
 *
 * The API's `InvoiceResponse` carries ~45 fields, every one of them optional,
 * and three separate notions of "status":
 *
 *   status         the entity lifecycle — published, deleted
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
  /** Human-facing number. Falls back to the id when the API has not issued one. */
  number: string
  customerId: string
  /** Display name, already resolved. The UI never joins data. */
  customerName: string
  status: InvoiceStatus
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
 * balance plus a due date in the past — a derivation every screen would
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

/**
 * Inputs to {@link deriveInvoiceStatus}, structurally typed.
 *
 * Deliberately not the SDK's `InvoiceResponse` — domain may not import
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
  if (dueDate && dueDate.getTime() < now.getTime()) return InvoiceStatus.Overdue

  return InvoiceStatus.Open
}

/** Statuses that should pull a billing operator's eye. */
export function needsAttention(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Overdue
}

/**
 * What the user is asking for: which invoices, in what order, on which page.
 *
 * Lives in the domain because it is product vocabulary, not transport — it says
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
}

export const InvoiceSortField = {
  IssuedAt: 'issuedAt',
  DueDate: 'dueDate',
  Total: 'total',
  Status: 'status',
} as const

export type InvoiceSortField = (typeof InvoiceSortField)[keyof typeof InvoiceSortField]

export const DEFAULT_INVOICE_QUERY: InvoiceQuery = {
  page: 1,
  pageSize: 25,
  sortBy: InvoiceSortField.IssuedAt,
  sortDirection: 'desc',
  statuses: [],
  search: '',
}
