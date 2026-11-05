import {
  CreditNoteStatus,
  InvoiceDocumentStatus,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  WalletStatus,
  WebhookDeliveryStatus,
  WorkflowStatus,
  type PortalSubscriptionStatus,
  type VersionStatus,
} from '@fp/domain'
import type { PillTone } from './cells'

/**
 * The one list of status colours. A status word has one tone wherever it
 * appears: a grid cell, a header chip, a dialog, the customer portal. Every
 * per-enum map below is built from it, and every status pill in the console
 * reads its tone from here, never from a local map.
 *
 * - success (green): done and healthy: paid, succeeded, active, completed, finalized.
 * - warning (yellow): waiting, possibly stuck, or undone: open, pending, processing,
 *   paused, voided.
 * - info (blue): coming up: an upcoming price version.
 * - trial (violet): trialing, and nothing else.
 * - neutral (grey): ended or quiet: draft, cancelled, refunded, skipped.
 * - danger (red): a problem that needs action: overdue, failed.
 *
 * Keys are normalised words (see {@link statusTone}): lower case, spaces for
 * `_`, `-` and camelCase, so `PAST_DUE`, `past-due` and `pastDue` all read
 * `past due`. A word missing here is grey.
 */
const STATUS_WORD_TONE: Record<string, PillTone> = {
  // Done
  active: 'success',
  paid: 'success',
  succeeded: 'success',
  overpaid: 'success',
  completed: 'success',
  finalized: 'success',
  published: 'success',
  enabled: 'success',
  healthy: 'success',
  processed: 'success',
  issued: 'success',
  synced: 'success',
  current: 'success',
  // Waiting, stuck or undone
  open: 'warning',
  pending: 'warning',
  'payment pending': 'warning',
  processing: 'warning',
  sending: 'warning',
  scheduled: 'warning',
  running: 'warning',
  'continued as new': 'warning',
  paused: 'warning',
  frozen: 'warning',
  incomplete: 'warning',
  partial: 'warning',
  'partially paid': 'warning',
  changed: 'warning',
  deprecated: 'warning',
  void: 'warning',
  voided: 'warning',
  // Coming up
  upcoming: 'info',
  // Trial
  trialing: 'trial',
  // Ended or quiet
  draft: 'neutral',
  archived: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  expired: 'neutral',
  refunded: 'neutral',
  'partially refunded': 'neutral',
  'refund issued': 'neutral',
  'invoice adjusted': 'neutral',
  skipped: 'neutral',
  cancelled: 'neutral',
  canceled: 'neutral',
  terminated: 'neutral',
  'timed out': 'neutral',
  closed: 'neutral',
  ended: 'neutral',
  history: 'neutral',
  other: 'neutral',
  'not synced': 'neutral',
  // Needs action
  overdue: 'danger',
  'past due': 'danger',
  failed: 'danger',
  'payment failed': 'danger',
}

function normalise(word: string): string {
  return word
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
}

/** The tone a status word carries, by word or label; grey when it is not a known status. */
export function statusTone(word: string): PillTone {
  return STATUS_WORD_TONE[normalise(word)] ?? 'neutral'
}

/** A tone per value of a status enum, read from the one list. */
function tonesFor<S extends string>(statuses: readonly S[]): Record<S, PillTone> {
  return Object.fromEntries(statuses.map((s) => [s, statusTone(s)])) as Record<S, PillTone>
}

export const INVOICE_STATUS_TONE = tonesFor(Object.values(InvoiceStatus))
export const INVOICE_DOCUMENT_STATUS_TONE = tonesFor(Object.values(InvoiceDocumentStatus))
export const PAYMENT_STATUS_TONE = tonesFor(Object.values(PaymentStatus))
export const SUBSCRIPTION_STATUS_TONE = tonesFor(Object.values(SubscriptionStatus))
export const CREDIT_NOTE_STATUS_TONE = tonesFor(Object.values(CreditNoteStatus))
export const WALLET_STATUS_TONE = tonesFor(Object.values(WalletStatus))
export const WEBHOOK_DELIVERY_STATUS_TONE = tonesFor(Object.values(WebhookDeliveryStatus))
export const WORKFLOW_STATUS_TONE = tonesFor(Object.values(WorkflowStatus))
export const VERSION_STATUS_TONE = tonesFor<VersionStatus>(['current', 'upcoming', 'history'])
export const PORTAL_SUBSCRIPTION_STATUS_TONE = tonesFor<PortalSubscriptionStatus>([
  'active',
  'trialing',
  'paused',
  'cancelled',
  'other',
])

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
