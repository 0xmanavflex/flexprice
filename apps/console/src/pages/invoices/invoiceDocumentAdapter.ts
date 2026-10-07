import type { InvoiceDetail } from '@fp/domain'
import type { InvoiceDocument } from '@fp/ui/pages'

const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

/** Display-only: the view formats these, and the API's own totals ride along unsummed. */
const num = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Maps the invoice read model onto the document the detail view renders.
 *
 * Figures come from the API (`totals`), not from the lines. What the API does
 * not send — issuer, payment method, payments, credit notes — is left out
 * rather than invented, and the timeline is only the lifecycle moments the
 * invoice actually timestamps.
 */
export function toInvoiceDocument(invoice: InvoiceDetail): InvoiceDocument {
  const events: InvoiceDocument['events'] = []
  const push = (title: string, at: Date | null, summary: string, status: 'completed' | 'issue') => {
    if (at) events.unshift({ id: events.length + 1, title, at: day(at) ?? '', status, summary })
  }
  push('Draft created', invoice.createdAt, 'The invoice was created.', 'completed')
  push('Invoice finalized', invoice.finalizedAt, 'The invoice was locked and issued.', 'completed')
  push('Paid', invoice.paidAt, 'Payment was received in full.', 'completed')
  push('Voided', invoice.voidedAt, 'The invoice was voided.', 'issue')
  // What is still to come, so a draft reads as a path rather than a dead end.
  // Only steps the invoice's own state implies: no "sent" step, the API does not say.
  const upcoming: InvoiceDocument['events'] = []
  const settled = invoice.paidAt || invoice.voidedAt
  if (!invoice.finalizedAt && !settled) {
    upcoming.push({
      id: 0,
      title: 'Invoice finalized',
      at: 'When the period closes',
      status: 'pending',
      summary: '',
    })
  }
  if (!settled && invoice.dueDate) {
    upcoming.push({
      id: 0,
      title: 'Payment due',
      at: day(invoice.dueDate) ?? '',
      status: 'pending',
      summary: '',
    })
  }
  events.unshift(...upcoming.map((event, index) => ({ ...event, id: events.length + 1 + index })))

  return {
    id: invoice.id,
    number: invoice.number === invoice.id ? null : invoice.number,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    currency: invoice.currency || 'USD',
    issuedAt: day(invoice.issuedAt),
    dueAt: day(invoice.dueDate),
    billTo: { name: invoice.customerName, email: invoice.customerEmail, address: '' },
    lines: invoice.lines.map((line) => ({
      id: line.id,
      description: line.description,
      ...(line.detail ? { detail: line.detail } : {}),
      quantity: line.quantity,
      amount: num(line.amount),
    })),
    prepaidCredits: num(invoice.prepaidCredits),
    tax: num(invoice.tax),
    paid: num(invoice.amountPaid),
    totals: {
      subtotal: num(invoice.subtotal),
      total: num(invoice.total.amount),
      due: num(invoice.amountRemaining.amount),
    },
    customerId: invoice.customerId,
    subscriptionLabel: invoice.subscriptionId ?? 'None',
    creditNotes: [],
    payments: [],
    events,
  }
}
