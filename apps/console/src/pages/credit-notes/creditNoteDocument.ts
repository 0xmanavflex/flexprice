import {
  CREDIT_NOTE_REASON_LABEL,
  CreditNoteStatus,
  CreditNoteType,
  type CreditNoteDetail,
  type CreditNoteReason,
  type InvoiceDetail,
} from '@fp/domain'
import type { CreditNoteDocument } from '@fp/ui/pages'

/** Join by invoice line ID, never position; retain exact API monetary values. */
export function toCreditNoteDocument(
  note: CreditNoteDetail,
  invoice?: InvoiceDetail,
): CreditNoteDocument {
  const source =
    invoice?.id === note.invoiceId &&
    invoice.currency.toUpperCase() === note.amount.currency.toUpperCase()
      ? invoice
      : undefined
  const date = (value: Date) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  // Finalized, else created: V1 dates every memo by its creation, so a memo
  // that was never finalized is not left without a date.
  const issued = note.finalizedAt ?? note.createdAt
  return {
    id: note.id,
    number: note.number,
    status: note.status,
    currency: note.amount.currency,
    amount: note.amount.amount,
    issuedAt: issued
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(issued)
      : null,
    creditTo: {
      name: note.customerName || note.customerId || '—',
      ...(source?.customerEmail ? { email: source.customerEmail } : {}),
      address: [],
    },
    customerId: note.customerId,
    invoiceId: note.invoiceId,
    invoiceNumber: note.invoiceNumber || source?.number || note.invoiceId || '—',
    reason: CREDIT_NOTE_REASON_LABEL[note.reason as CreditNoteReason] ?? note.reason,
    memo: note.memo,
    settlement:
      note.status === CreditNoteStatus.Voided
        ? 'void'
        : note.status === CreditNoteStatus.Draft
          ? 'pending'
          : note.type === CreditNoteType.Adjustment
            ? 'adjusted'
            : 'unknown',
    refundStatus: note.refundStatus,
    ...(source
      ? { invoiceTotal: source.total.amount, invoiceAmountDue: source.amountDue.amount }
      : {}),
    lines: note.lines.map((line) => ({
      id: line.id,
      description: line.description,
      credited: line.amount.amount,
      invoiced:
        source?.lines.find((original) => original.id === line.invoiceLineItemId)?.amount ?? null,
    })),
    events: [
      { id: 1, title: 'Credit memo created', at: note.createdAt },
      { id: 2, title: 'Credit memo finalized', at: note.finalizedAt },
      { id: 3, title: 'Credit memo voided', at: note.voidedAt },
    ]
      .filter((event) => event.at !== null)
      .sort((a, b) => b.at!.getTime() - a.at!.getTime())
      .map((event) => ({
        ...event,
        at: date(event.at!),
        status: 'completed',
        summary: note.number,
      })),
  }
}
