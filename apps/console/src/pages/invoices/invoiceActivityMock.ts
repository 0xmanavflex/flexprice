import { InvoiceStatus, type InvoiceDetail } from '@fp/domain'
import type { InvoiceActivity } from '@fp/ui/pages'

/**
 * MOCK — the invoice activity log, until the Activity API lands.
 *
 * Everything the invoice detail rail shows under "Activity" comes from this one
 * adapter. It builds the log from the lifecycle timestamps the invoice itself
 * carries (created, finalized, paid, voided) plus the upcoming steps its state
 * implies. When the Activity API arrives, replace `mockInvoiceActivity` with a
 * mapper over that endpoint's events and delete this file; nothing else in the
 * page needs to change.
 */
export const INVOICE_ACTIVITY_IS_MOCK = true

const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

export function mockInvoiceActivity(invoice: InvoiceDetail): InvoiceActivity[] {
  const events: InvoiceActivity[] = []
  const push = (title: string, at: Date | null, summary: string, status: 'completed' | 'issue') => {
    if (at) events.unshift({ id: events.length + 1, title, at: day(at) ?? '', status, summary })
  }
  push('Draft created', invoice.createdAt, 'The invoice was created.', 'completed')
  push('Invoice finalized', invoice.finalizedAt, 'The invoice was locked and issued.', 'completed')
  push('Paid', invoice.paidAt, 'Payment was received in full.', 'completed')
  push('Voided', invoice.voidedAt, 'The invoice was voided.', 'issue')

  // What is still to come, so a draft reads as a path rather than a dead end.
  const upcoming: InvoiceActivity[] = []
  const settled =
    invoice.paidAt ||
    invoice.voidedAt ||
    invoice.status === InvoiceStatus.Paid ||
    invoice.status === InvoiceStatus.Void
  if (!invoice.finalizedAt && !settled && invoice.status === InvoiceStatus.Draft) {
    upcoming.push({
      id: 0,
      title: 'Invoice finalized',
      at: 'When the period closes',
      status: 'pending',
      summary: 'Finalizing assigns the invoice number.',
    })
  }
  if (!settled && invoice.dueDate) {
    upcoming.push({
      id: 0,
      title: 'Payment due',
      at: day(invoice.dueDate) ?? '',
      status: invoice.status === InvoiceStatus.Overdue ? 'issue' : 'pending',
      summary:
        invoice.status === InvoiceStatus.Overdue
          ? 'The due date has passed with a balance outstanding.'
          : 'The balance is due on this date.',
    })
  }
  events.unshift(...upcoming.map((event, index) => ({ ...event, id: events.length + 1 + index })))
  return events
}
