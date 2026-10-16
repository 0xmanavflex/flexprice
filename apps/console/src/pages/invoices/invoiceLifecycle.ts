import type { InvoiceDetail } from '@fp/domain'
import type { InvoiceActivity } from '@fp/ui/pages'

/**
 * The invoice's lifecycle, read from the timestamps the invoice record itself
 * carries (created, finalized, paid, voided). These are facts the API returned,
 * not an audit log: who did what, and sends, retries and edits, are not
 * recorded here. The view labels it accordingly.
 *
 * Nothing speculative is listed. A draft does not show "will finalize" and an
 * open invoice does not show "payment due" as if it had happened.
 */
const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

export function invoiceLifecycle(invoice: InvoiceDetail): InvoiceActivity[] {
  const events: InvoiceActivity[] = []
  const push = (title: string, at: Date | null, summary: string, status: 'completed' | 'issue') => {
    if (at) events.unshift({ id: events.length + 1, title, at: day(at) ?? '', status, summary })
  }
  push('Draft created', invoice.createdAt, 'The invoice was created.', 'completed')
  push('Invoice finalized', invoice.finalizedAt, 'The invoice was locked and issued.', 'completed')
  push('Paid', invoice.paidAt, 'Payment was received in full.', 'completed')
  push('Voided', invoice.voidedAt, 'The invoice was voided.', 'issue')
  return events
}
