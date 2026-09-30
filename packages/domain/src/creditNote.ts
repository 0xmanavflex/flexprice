/**
 * A credit note, as the list reads it.
 *
 * A credit note refunds or adjusts an invoice after it was issued. It starts as
 * a draft, becomes final when processed, and can be voided. The amount crosses
 * this boundary as a `Money`, never a bare number beside a currency.
 */
import type { Money } from './money'

export const CreditNoteStatus = {
  Draft: 'draft',
  Finalized: 'finalized',
  Voided: 'voided',
} as const
export type CreditNoteStatus = (typeof CreditNoteStatus)[keyof typeof CreditNoteStatus]

export const CREDIT_NOTE_STATUS_LABEL: Record<CreditNoteStatus, string> = {
  [CreditNoteStatus.Draft]: 'Draft',
  [CreditNoteStatus.Finalized]: 'Finalized',
  [CreditNoteStatus.Voided]: 'Voided',
}

export const CreditNoteType = {
  Adjustment: 'adjustment',
  Refund: 'refund',
} as const
export type CreditNoteType = (typeof CreditNoteType)[keyof typeof CreditNoteType]

export const CREDIT_NOTE_TYPE_LABEL: Record<CreditNoteType, string> = {
  [CreditNoteType.Adjustment]: 'Adjustment',
  [CreditNoteType.Refund]: 'Refund',
}

export interface CreditNote {
  id: string
  /** Human number, falling back to the id's first eight characters like V1. */
  number: string
  status: CreditNoteStatus
  type: CreditNoteType | null
  amount: Money
  invoiceNumber: string
  customerName: string
  createdAt: Date | null
}

export interface CreditNoteQuery {
  page: number
  pageSize: number
  search: string
  statuses: CreditNoteStatus[]
}

export const DEFAULT_CREDIT_NOTE_QUERY: CreditNoteQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
}
