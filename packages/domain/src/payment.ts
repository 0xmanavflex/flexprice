/**
 * A payment, as the list reads it.
 *
 * A payment is money moving against an invoice — a collection that succeeded,
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
import type { Money } from './money'

/**
 * The state a person actually cares about.
 *
 * The wire's nine values fold to six: the three flavours of "not done yet"
 * become one `pending`, and both refund shapes become one `refunded`. What is
 * left is the set a collections view acts on — did it land, is it still going,
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

/** The read model the list renders. */
export interface Payment {
  id: string
  amount: Money
  status: PaymentStatus
  /** How the money moved — card, ACH, and so on. Empty when the API omits it. */
  methodType: string
  /** The invoice this was collected against. Empty when unlinked. */
  invoiceNumber: string
  createdAt: Date | null
  /** When it landed. Null until (and unless) it does. */
  succeededAt: Date | null
}

/**
 * How the list is ordered.
 *
 * A payment is an event, so the only axis that reads is when it happened —
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
 * Product vocabulary, not transport, and it has to survive a URL round-trip —
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
