import { CreditNoteStatus } from '@fp/domain'
import type { InvoiceActivity, InvoiceParty, StatusChip } from '../invoices/invoiceDocument'

/**
 * A credit memo as its page reads it — the invoice document's shape, for the
 * document that undoes part of one.
 *
 * It borrows `InvoiceParty` and `InvoiceActivity` rather than restating them:
 * the party being credited is the party that was billed, and an activity entry
 * is an activity entry. Only the lines differ, and they differ in the way that
 * matters — a credit line is a *pair*, what was invoiced beside what is being
 * taken back, which is the one comparison the old key/value list could not
 * make.
 */

export interface CreditNoteLine {
  id: string
  description: string
  /**
   * What the invoice charged for this line.
   *
   * `null` when the invoice has not been read, or when no line on it matches —
   * a credit can be raised against a line that was since removed. Null prints
   * an em dash rather than a zero, because "we do not know" and "nothing was
   * charged" are different and only one of them is reassuring.
   */
  invoiced: number | null
  /** What this memo credits back. */
  credited: number
}

/** How the credit was settled, once it is final. */
export const CreditSettlement = {
  /** Money went back to the payment method. */
  Refunded: 'refunded',
  /** The invoice's amount due came down instead. */
  Adjusted: 'adjusted',
  /** Raised, not yet applied. */
  Pending: 'pending',
  /** Cancelled before it settled; it credits nothing. */
  Void: 'void',
} as const
export type CreditSettlement = (typeof CreditSettlement)[keyof typeof CreditSettlement]

export interface CreditNoteDocument {
  id: string
  number: string
  status: CreditNoteStatus
  currency: string
  /** The total credited, as a number so the view formats it with the rest. */
  amount: number
  issuedAt: string | null
  /** Who is being credited. */
  creditTo: InvoiceParty
  customerId: string
  /** The invoice this credits. */
  invoiceId: string
  invoiceNumber: string
  /** Why, already in the reader's words rather than the API's enum. */
  reason: string
  memo: string
  settlement: CreditSettlement
  lines: CreditNoteLine[]
  metadata?: Readonly<Record<string, string>>
  events: InvoiceActivity[]
}

/**
 * The sentence the footer says.
 *
 * A credit memo's last question is always "so what happened to the money",
 * and the answer is one of four things. Saying it in a sentence beats a
 * `refund_status` chip that the reader has to translate.
 */
export function settlementNote(document: CreditNoteDocument, amount: string): string {
  switch (document.settlement) {
    case CreditSettlement.Refunded:
      return `${amount} was refunded to the payment method on file.`
    case CreditSettlement.Adjusted:
      return `${amount} came off invoice ${document.invoiceNumber}; nothing was refunded.`
    case CreditSettlement.Void:
      return 'This memo was voided. It credits nothing and the invoice is unchanged.'
    case CreditSettlement.Pending:
      return document.status === CreditNoteStatus.Draft
        ? `A draft credits nothing yet. Finalizing applies ${amount} to invoice ${document.invoiceNumber}.`
        : `${amount} is being applied to invoice ${document.invoiceNumber}.`
  }
}

/** The chips beside the title: the status, then the settlement when it adds something. */
export function creditNoteChips(document: CreditNoteDocument): StatusChip[] {
  const status: Record<CreditNoteStatus, StatusChip> = {
    [CreditNoteStatus.Draft]: { label: 'Draft', tone: 'neutral' },
    [CreditNoteStatus.Finalized]: { label: 'Finalized', tone: 'success' },
    [CreditNoteStatus.Voided]: { label: 'Voided', tone: 'danger' },
  }
  const chips: StatusChip[] = [status[document.status]]
  // Void already says it; draft has nothing to add. The other two are the news.
  if (document.settlement === CreditSettlement.Refunded) {
    chips.push({ label: 'Refunded', tone: 'info' })
  }
  if (document.settlement === CreditSettlement.Adjusted) {
    chips.push({ label: 'Invoice adjusted', tone: 'info' })
  }
  return chips
}

/** Totals for the lines table: what was invoiced, what is credited, what is left. */
export function creditNoteTotals(document: CreditNoteDocument): {
  invoiced: number | null
  credited: number
  remaining: number | null
} {
  // A single unmatched line makes the invoiced column a guess, so the total is
  // withheld rather than quietly summing the lines that did match.
  const known = document.lines.every((line) => line.invoiced !== null)
  const invoiced = known
    ? document.lines.reduce((sum, line) => sum + (line.invoiced ?? 0), 0)
    : null
  const credited = document.lines.reduce((sum, line) => sum + line.credited, 0)
  return { invoiced, credited, remaining: invoiced === null ? null : invoiced - credited }
}
