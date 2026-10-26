import { CreditNoteStatus, InvoiceStatus, PaymentStatus, SubscriptionStatus } from '@fp/domain'
import type { PillTone } from './cells'

/**
 * One tone per status, per enum: the colour semantics the whole console uses.
 *
 * - success (green): done and healthy: paid, succeeded, active, completed.
 * - warning (yellow): waiting or possibly stuck: open, pending, processing, paused.
 * - info (blue): finalized, and other settled-but-not-finished document states.
 * - trial (violet): trialing, and nothing else.
 * - neutral (grey): terminal or quiet: draft, cancelled, refunded, voided, skipped.
 * - danger (red): a problem that needs action: overdue, failed. Kept red until the
 *   palette for problems is decided; the agreed palette names no red.
 *
 * Every badge and grid reads from here, so one status is one colour everywhere.
 */
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, PillTone> = {
  [InvoiceStatus.Draft]: 'neutral',
  [InvoiceStatus.Open]: 'warning',
  [InvoiceStatus.Paid]: 'success',
  [InvoiceStatus.Overdue]: 'danger',
  [InvoiceStatus.Void]: 'neutral',
  [InvoiceStatus.Skipped]: 'neutral',
}

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.Pending]: 'warning',
  [PaymentStatus.Succeeded]: 'success',
  // Paid in full and then some: still paid.
  [PaymentStatus.Overpaid]: 'success',
  [PaymentStatus.Failed]: 'danger',
  [PaymentStatus.Refunded]: 'neutral',
  [PaymentStatus.Voided]: 'neutral',
}

export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, PillTone> = {
  [SubscriptionStatus.Active]: 'success',
  [SubscriptionStatus.Trialing]: 'trial',
  [SubscriptionStatus.Paused]: 'warning',
  [SubscriptionStatus.Cancelled]: 'neutral',
  // Waiting on a first payment: possibly stuck.
  [SubscriptionStatus.Incomplete]: 'warning',
}

export const CREDIT_NOTE_STATUS_TONE: Record<CreditNoteStatus, PillTone> = {
  [CreditNoteStatus.Draft]: 'neutral',
  [CreditNoteStatus.Finalized]: 'info',
  [CreditNoteStatus.Voided]: 'neutral',
}

/** A pill tone as the text and dot classes a glyph badge uses. */
export const TONE_TEXT: Record<PillTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  info: 'text-info',
  trial: 'text-trial',
  warning: 'text-warning',
  danger: 'text-destructive',
}

export const TONE_DOT: Record<PillTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  info: 'bg-info',
  trial: 'bg-trial',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}
