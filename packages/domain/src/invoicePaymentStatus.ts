import { InvoiceStatus } from './invoice'
import { PaymentStatus } from './payment'

/**
 * Setting an invoice's payment status by hand: `PUT /invoices/{id}/payment`:
 * for money that moved outside Flexprice.
 *
 * The backend allows it only on a draft or finalized invoice with no succeeded
 * payment record, and only along these transitions (`validatePaymentStatusTransition`
 * in the invoice service). Offering anything else is offering a refusal, so the
 * console asks these rules first.
 */
const TRANSITIONS: Partial<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  [PaymentStatus.Pending]: [
    PaymentStatus.Succeeded,
    PaymentStatus.Failed,
    PaymentStatus.Overpaid,
    PaymentStatus.Pending,
  ],
  [PaymentStatus.Failed]: [
    PaymentStatus.Succeeded,
    PaymentStatus.Pending,
    PaymentStatus.Overpaid,
    PaymentStatus.Failed,
  ],
  [PaymentStatus.Succeeded]: [PaymentStatus.Overpaid],
  [PaymentStatus.Overpaid]: [],
}

/** What each manual status means for the invoice, as the backend applies it. */
export const MANUAL_PAYMENT_STATUS_EFFECT: Partial<Record<PaymentStatus, string>> = {
  [PaymentStatus.Succeeded]: 'Paid in full. The balance becomes zero.',
  [PaymentStatus.Failed]: 'Not paid. The full amount is owed again.',
  [PaymentStatus.Pending]: 'Awaiting payment. Optionally record how much has been paid so far.',
  [PaymentStatus.Overpaid]: 'More than the amount due was received.',
}

/** The wire value for a manual status: the API takes them uppercase. */
export function toWirePaymentStatus(status: PaymentStatus): string {
  return status.toUpperCase()
}

/**
 * The statuses this invoice can be moved to by hand. Pending stays on offer
 * while pending, because re-setting it is how a partial amount is recorded.
 * An invoice with no payment status yet is treated as pending, which is what
 * the backend stores for one.
 */
export function manualPaymentStatusChoices(current: PaymentStatus | null): PaymentStatus[] {
  return [...(TRANSITIONS[current ?? PaymentStatus.Pending] ?? [])]
}

/**
 * Why the payment status cannot be set by hand, or null when it can. The menu
 * shows this as the disabled item's hint rather than hiding the item.
 */
export function manualPaymentStatusBlocked(invoice: {
  status: InvoiceStatus
  paymentStatus: PaymentStatus | null
  /** How many succeeded payment records the invoice has. */
  succeededPayments: number
}): string | null {
  if (invoice.status === InvoiceStatus.Void) return 'Void invoices cannot change'
  if (invoice.status === InvoiceStatus.Skipped) return 'Skipped invoices cannot change'
  if (invoice.succeededPayments > 0) return 'Recorded payments set the status'
  if (manualPaymentStatusChoices(invoice.paymentStatus).length === 0) {
    return 'No further change is possible'
  }
  return null
}
