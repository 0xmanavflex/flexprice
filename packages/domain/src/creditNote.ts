/**
 * A credit note, as the list reads it.
 *
 * A credit note refunds or adjusts an invoice after it was issued. It starts as
 * a draft, becomes final when processed, and can be voided. The amount crosses
 * this boundary as a `Money`, never a bare number beside a currency.
 */
import { z } from 'zod'
import type { ListFilter } from './listFilter'
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
  /** The billing entity that issued it; absent when the API sends none. */
  billingEntityId?: string
}

export interface CreditNoteQuery {
  page: number
  pageSize: number
  search: string
  statuses: CreditNoteStatus[]
  /** Field filters sent to the server; only the billing entity, while entities are enabled. */
  filters?: ListFilter[]
}

export const DEFAULT_CREDIT_NOTE_QUERY: CreditNoteQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  filters: [],
}

export const CreditNoteReason = {
  Duplicate: 'DUPLICATE',
  Fraudulent: 'FRAUDULENT',
  OrderChange: 'ORDER_CHANGE',
  Unsatisfactory: 'UNSATISFACTORY',
  ServiceIssue: 'SERVICE_ISSUE',
  BillingError: 'BILLING_ERROR',
  SubscriptionCancellation: 'SUBSCRIPTION_CANCELLATION',
} as const
export type CreditNoteReason = (typeof CreditNoteReason)[keyof typeof CreditNoteReason]

export const CREDIT_NOTE_REASON_LABEL: Record<CreditNoteReason, string> = {
  DUPLICATE: 'Duplicate charge',
  FRAUDULENT: 'Fraudulent',
  ORDER_CHANGE: 'Order change',
  UNSATISFACTORY: 'Unsatisfactory service',
  SERVICE_ISSUE: 'Service issue',
  BILLING_ERROR: 'Billing error',
  SUBSCRIPTION_CANCELLATION: 'Subscription cancellation',
}

export const CREDIT_NOTE_REFUND_TARGET_LABEL = {
  PREPAID_WALLET: 'Prepaid wallet',
  BACK_TO_SOURCE: 'Back to the original payment method',
} as const

export interface CreditNoteDetailLine {
  id: string
  invoiceLineItemId: string
  description: string
  amount: Money
}

/** One credit note with the fields only its own page shows. */
export interface CreditNoteDetail extends CreditNote {
  invoiceId: string
  customerId: string
  reason: string
  memo: string
  refundStatus: string
  lines: CreditNoteDetailLine[]
  finalizedAt: Date | null
  voidedAt: Date | null
}

/**
 * Credit part of an invoice. Each invoice line is offered with an amount to
 * credit; blank lines are left out. The API works out the total and whether
 * the note is a refund or an adjustment, so neither is computed here.
 */
export const createCreditNoteSchema = z
  .object({
    invoiceId: z.string().min(1, 'Choose an invoice'),
    reason: z.enum([
      'DUPLICATE',
      'FRAUDULENT',
      'ORDER_CHANGE',
      'UNSATISFACTORY',
      'SERVICE_ISSUE',
      'BILLING_ERROR',
      'SUBSCRIPTION_CANCELLATION',
    ]),
    memo: z.string().trim().max(500, 'Keep it under 500 characters'),
    /** Empty lets the API choose. */
    refundTarget: z.enum(['', 'PREPAID_WALLET', 'BACK_TO_SOURCE']),
    processNow: z.boolean(),
    lines: z.array(
      z.object({
        invoiceLineItemId: z.string(),
        label: z.string(),
        amount: z
          .string()
          .trim()
          .regex(/^(\d+(\.\d{1,8})?)?$/, 'Enter an amount like 20 or 20.50'),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.lines.some((line) => line.amount.trim() !== '' && Number(line.amount) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Credit at least one line' })
    }
  })
export type CreateCreditNote = z.infer<typeof createCreditNoteSchema>

export function emptyCreditNote(): CreateCreditNote {
  return {
    invoiceId: '',
    reason: 'BILLING_ERROR',
    memo: '',
    refundTarget: '',
    processNow: false,
    lines: [],
  }
}
