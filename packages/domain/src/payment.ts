/**
 * A payment, as the list reads it.
 *
 * A payment is money moving against an invoice: a collection that succeeded,
 * one still in flight, or one that failed and needs chasing. The API's
 * `PaymentResponse` carries ~30 optional fields and a lifecycle far finer than
 * a list needs: it distinguishes `INITIATED` from `PENDING` from `PROCESSING`,
 * and `REFUNDED` from `PARTIALLY_REFUNDED`. None of those distinctions changes
 * what a billing operator does about the row, so the domain collapses them.
 *
 * As with an invoice, the amount crosses this boundary as a domain `Money`
 * (never the API's bare `amount` string beside a separate `currency`), so no
 * cell ever sees the two apart or reaches for `parseFloat`.
 */
import { z } from 'zod'
import type { Money } from './money'

/**
 * The state a person actually cares about.
 *
 * The wire's nine values fold to six: the three flavours of "not done yet"
 * become one `pending`, and both refund shapes become one `refunded`. What is
 * left is the set a collections view acts on: did it land, is it still going,
 * did it fail, was it reversed.
 */
export const PaymentStatus = {
  Pending: 'pending',
  Succeeded: 'succeeded',
  Overpaid: 'overpaid',
  Failed: 'failed',
  Refunded: 'refunded',
  Voided: 'voided',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PaymentStatus.Pending]: 'Pending',
  [PaymentStatus.Succeeded]: 'Succeeded',
  [PaymentStatus.Overpaid]: 'Overpaid',
  [PaymentStatus.Failed]: 'Failed',
  [PaymentStatus.Refunded]: 'Refunded',
  [PaymentStatus.Voided]: 'Voided',
}

/**
 * The wire's nine payment states onto the domain's six.
 *
 * Lives here rather than in the transport layer because two resources need the
 * same collapse: a payment's own `payment_status`, and the `payment_status` an
 * invoice carries about itself. Two copies of this table is how the Payments
 * list and the Invoices list end up disagreeing about whether
 * `PARTIALLY_REFUNDED` counts as a refund.
 *
 * Anything unrecognised comes back absent rather than guessed, and a cell
 * renders that as an em dash. An unknown state is not `pending`.
 */
const WIRE_PAYMENT_STATUS: Record<string, PaymentStatus> = {
  INITIATED: PaymentStatus.Pending,
  PENDING: PaymentStatus.Pending,
  PROCESSING: PaymentStatus.Pending,
  SUCCEEDED: PaymentStatus.Succeeded,
  OVERPAID: PaymentStatus.Overpaid,
  FAILED: PaymentStatus.Failed,
  REFUNDED: PaymentStatus.Refunded,
  PARTIALLY_REFUNDED: PaymentStatus.Refunded,
  VOIDED: PaymentStatus.Voided,
}

/** The wire's payment status as the domain's, or `null` when it says nothing
 *  this build understands. */
export function toPaymentStatus(wire: string | null | undefined): PaymentStatus | null {
  return WIRE_PAYMENT_STATUS[wire ?? ''] ?? null
}

/** The read model the list renders. */
export interface Payment {
  id: string
  amount: Money
  status: PaymentStatus
  /** How the money moved: card, ACH, and so on. Empty when the API omits it. */
  methodType: string
  /**
   * Who moved it: the processor the payment was taken through.
   *
   * `PaymentResponse.paymentGateway` on the wire. Distinct from
   * {@link Payment.methodType}: "card" is what the customer presented, Stripe
   * is who charged it, and a collections view chasing a failure needs the
   * second to know where to go and look. Empty when the API omits it: which
   * it does for anything not collected through a gateway at all.
   */
  gateway: string
  /** The invoice this was collected against. Empty when unlinked. */
  invoiceNumber: string
  createdAt: Date | null
  /** When it landed. Null until (and unless) it does. */
  succeededAt: Date | null
  /** The gateway's own id for the charge (`pi_…`), when it went through one. */
  gatewayPaymentId?: string
}

/**
 * How the list is ordered.
 *
 * A payment is an event, so the only axis that reads is when it happened:
 * there is no name to sort by. One field, kept as a set so the query and the
 * URL parser share the same fact.
 */
export const PaymentSortField = {
  CreatedAt: 'createdAt',
} as const
export type PaymentSortField = (typeof PaymentSortField)[keyof typeof PaymentSortField]

export const PAYMENT_SORT_LABEL: Record<PaymentSortField, string> = {
  [PaymentSortField.CreatedAt]: 'Created',
}

/**
 * What the user is asking for: which payments, in what order, on which page.
 *
 * Product vocabulary, not transport, and it has to survive a URL round-trip:
 * the page keeps this in search params rather than in component state. There is
 * no `view`: a payment is a row, not a card.
 */
export interface PaymentQuery {
  page: number
  pageSize: number
  search: string
  statuses: PaymentStatus[]
  sortBy: PaymentSortField
  sortDirection: 'asc' | 'desc'
}

export const DEFAULT_PAYMENT_QUERY: PaymentQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  // Newest first: the payment a person came to check is almost always a recent
  // one.
  sortBy: PaymentSortField.CreatedAt,
  sortDirection: 'desc',
}

/** One payment with the fields only its own page shows. */
export interface PaymentDetail extends Payment {
  invoiceId: string
  destinationType: string
  gatewayPaymentId: string
  paymentUrl: string
  errorMessage: string
  attempts: number
  failedAt: Date | null
  refundedAt: Date | null
  voidedAt: Date | null
}

export const PaymentMethod = {
  Offline: 'OFFLINE',
  Credits: 'CREDITS',
  Card: 'CARD',
  Ach: 'ACH',
  Upi: 'UPI',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  OFFLINE: 'Offline (recorded manually)',
  CREDITS: 'Credits (from a wallet)',
  CARD: 'Card',
  ACH: 'ACH',
  UPI: 'UPI',
}

/**
 * What a person records a payment as, as V1 offers it: money that moved
 * outside Flexprice, or credits drawn from the customer's wallet. Card, ACH
 * and UPI payments arrive through a gateway, not this form.
 */
export const RECORDABLE_PAYMENT_METHODS = [PaymentMethod.Offline, PaymentMethod.Credits] as const

/** Record a payment against an invoice. The amount is typed; the API owns the arithmetic. */
export const recordPaymentSchema = z
  .object({
    invoiceId: z.string().min(1, 'Choose an invoice'),
    currency: z.string().trim().length(3, 'Choose a currency'),
    amount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,8})?$/, 'Enter an amount like 120 or 120.50')
      .refine((value) => Number(value) > 0, 'Enter an amount above zero'),
    methodType: z.enum(['OFFLINE', 'CREDITS', 'CARD', 'ACH', 'UPI']),
    /** The wallet the credits come from; required for `CREDITS`. */
    walletId: z.string().optional(),
    /** Run the payment straight away instead of leaving it initiated. */
    processNow: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.methodType === PaymentMethod.Credits && !value.walletId)
      ctx.addIssue({ code: 'custom', path: ['walletId'], message: 'Choose the wallet to pay from' })
  })
export type RecordPayment = z.infer<typeof recordPaymentSchema>

export function emptyPayment(): RecordPayment {
  return { invoiceId: '', currency: '', amount: '', methodType: 'OFFLINE', processNow: true }
}
