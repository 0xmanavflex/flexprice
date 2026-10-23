/**
 * Self-billing: the tenant's own Flexprice account — trial, upgrade, live, and
 * the locked (read-only) state.
 *
 * Read from `GET /portal/billing/status` (is it on, and the tenant's state) and
 * `GET /portal/billing/summary` (subscription, invoices and usage, as Flexprice
 * Cloud bills this tenant). Upgrading is `POST /portal/billing/checkout`, which
 * hands back a Stripe Checkout URL; the page Stripe returns to polls
 * `GET /portal/billing/checkout/{id}`.
 *
 * A suspended tenant can read everything and write nothing: the API refuses a
 * write with `403 "tenant account is suspended"`, except ingest and the billing
 * routes it needs to pay its way back.
 */
import { z } from 'zod'

/** The one plan a tenant upgrades to, as the pricing page sells it. */
export const SELF_BILLING_PLAN = {
  name: 'Pay as you go',
  /** The monthly platform fee, in USD. */
  base: 199,
  /** The share of what the tenant bills through Flexprice in production. */
  rate: 0.005,
  currency: 'USD',
  trialDays: 30,
} as const

export const AccountState = {
  Trialing: 'trialing',
  Active: 'active',
  Suspended: 'suspended',
} as const
export type AccountState = (typeof AccountState)[keyof typeof AccountState]

/** Why a suspended account is locked. Only the copy changes. */
export type LockReason = 'trial_end' | 'event_limit'

export interface SelfBillingStatus {
  /** Self-billing is off on deployments that do not bill their tenants. */
  enabled: boolean
  state: AccountState | null
}

export type SelfInvoiceStatus = 'paid' | 'open' | 'overdue'

export interface SelfBillingInvoice {
  id: string
  number: string
  status: SelfInvoiceStatus
  total: number
  currency: string
  /** `YYYY-MM-DD`, when the invoice has a due date. */
  dueDate: string | null
  pdfUrl: string | null
}

export interface SelfBillingSummary {
  state: AccountState
  /** `YYYY-MM-DD` the trial ends, while the subscription has one. */
  trialEndsOn: string | null
  invoices: SelfBillingInvoice[]
  /** Events ingested this period, and the trial's cap (none once active). Null without usage. */
  events: { used: number; cap: number | null } | null
  /** What the tenant invoiced its customers through Flexprice this period. Null without usage. */
  billed: number | null
  /** The current billing period, `YYYY-MM-DD` each. */
  period: { start: string; end: string } | null
}

/** Whole days from `today` to `day`, both `YYYY-MM-DD`; never below zero. */
export function daysUntil(day: string, today: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0
}

/** Within this many days of the trial's end, or past this share of its events, the trial is urgent. */
export const URGENT_DAYS = 7
export const URGENT_SHARE = 0.8

export interface TrialProgress {
  daysLeft: number
  /** Events used ÷ the cap, 0 without a cap. */
  share: number
  urgent: boolean
}

export function trialProgress(summary: SelfBillingSummary, today: string): TrialProgress {
  const daysLeft = summary.trialEndsOn ? daysUntil(summary.trialEndsOn, today) : 0
  const cap = summary.events?.cap ?? null
  const share = cap ? (summary.events?.used ?? 0) / cap : 0
  return { daysLeft, share, urgent: daysLeft <= URGENT_DAYS || share >= URGENT_SHARE }
}

/**
 * Why a suspended account is locked: its trial used every event before it
 * ended, or the trial ended unpaid. The API does not say which, so it is read
 * from the summary: a full event cap while the trial still has days left means
 * the event limit. Once the trial's end has passed it is the trial end, cap or
 * not — the API suspends an expired trial whatever its usage.
 */
export function lockReason(
  summary: SelfBillingSummary,
  today: string = new Date().toISOString().slice(0, 10),
): LockReason {
  const cap = summary.events?.cap ?? null
  const capped = cap !== null && (summary.events?.used ?? 0) >= cap
  const trialOver = summary.trialEndsOn !== null && summary.trialEndsOn <= today
  return capped && !trialOver ? 'event_limit' : 'trial_end'
}

export type PillTone = 'trial' | 'urgent' | 'locked'

export interface AccountPill {
  tone: PillTone
  label: string
}

const daysText = (n: number) => (n === 1 ? '1 day' : `${n} days`)

/** The top-bar pill: none once active; red when locked; amber when urgent; purple otherwise. */
export function accountPill(summary: SelfBillingSummary, today: string): AccountPill | null {
  if (summary.state === AccountState.Active) return null
  if (summary.state === AccountState.Suspended) return { tone: 'locked', label: 'Account locked' }
  const trial = trialProgress(summary, today)
  return {
    tone: trial.urgent ? 'urgent' : 'trial',
    label:
      trial.share >= URGENT_SHARE
        ? `Trial · ${Math.round(trial.share * 100)}% of events`
        : `Trial · ${daysText(trial.daysLeft)} left`,
  }
}

/** `YYYY-MM-DD` as "Nov 4, 2026". */
export function longDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
}

/** `YYYY-MM-DD` as "Nov 4". */
export function shortDate(day: string): string {
  return longDate(day).replace(/, \d{4}$/, '')
}

export function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const wholeUsd = (amount: number) => `$${amount.toLocaleString('en-US')}`
export const planRateText = `${SELF_BILLING_PLAN.rate * 100}%`

/** The hover card's line: why it is locked, or what happens next. */
export function accountCopy(summary: SelfBillingSummary, today: string): string {
  const cap = summary.events?.cap?.toLocaleString('en-US') ?? ''
  if (summary.state === AccountState.Suspended) {
    if (lockReason(summary, today) === 'event_limit')
      return `Your account is locked and read-only. You used all ${cap} trial events.`
    return summary.trialEndsOn
      ? `Your account is locked and read-only. Your trial ended on ${shortDate(summary.trialEndsOn)}.`
      : 'Your account is locked and read-only.'
  }
  const trial = trialProgress(summary, today)
  const ends = summary.trialEndsOn ? longDate(summary.trialEndsOn) : ''
  if (trial.share >= URGENT_SHARE)
    return `${Math.round(trial.share * 100)}% of trial events used. At ${cap} your account becomes read-only.`
  if (trial.daysLeft <= URGENT_DAYS)
    return `Ends on ${ends}. After that your account becomes read-only.`
  return `Ends on ${ends}${cap ? `, or at ${cap} events` : ''}. Then ${wholeUsd(SELF_BILLING_PLAN.base)} a month + ${planRateText}.`
}

/** The reason every disabled write control gives while the account is locked. */
export const LOCKED_REASON = 'Your account is locked. Upgrade to make changes.'

/** Paid, or else open until its due date passes and overdue after. */
export function selfInvoiceStatus(
  paymentStatus: string,
  dueDate: string | null,
  today: string,
): SelfInvoiceStatus {
  if (paymentStatus.toLowerCase() === 'succeeded') return 'paid'
  return dueDate && dueDate < today ? 'overdue' : 'open'
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */

/** The details the Upgrade page collects before Stripe takes the card. */
export const checkoutDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Enter your company name'),
  email: z.string().trim().min(1, 'Enter a billing email').email('Enter a billing email'),
  country: z.string().trim().length(2, 'Choose your country'),
  line1: z.string().trim().min(1, 'Enter your address'),
  line2: z.string().trim(),
  city: z.string().trim().min(1, 'Enter your city'),
  state: z.string().trim(),
  postalCode: z.string().trim().min(1, 'Enter your postal code'),
  taxId: z.string().trim(),
})
export type CheckoutDetails = z.infer<typeof checkoutDetailsSchema>

export function emptyCheckoutDetails(): CheckoutDetails {
  return {
    name: '',
    email: '',
    country: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    taxId: '',
  }
}

export const CheckoutStatus = {
  Initiated: 'initiated',
  Pending: 'pending',
  Completed: 'completed',
  Failed: 'failed',
  Expired: 'expired',
} as const
export type CheckoutStatus = (typeof CheckoutStatus)[keyof typeof CheckoutStatus]

export interface SelfBillingCheckout {
  checkoutId: string
  /** Stripe Checkout, or the billing portal when the trial's invoice is paid there. */
  url: string
  status: CheckoutStatus
  /** Settled: completed, failed or expired. */
  terminal: boolean
  state: AccountState | null
}

/** What the page Stripe returns to shows. */
export type CheckoutOutcome = 'processing' | 'success' | 'failed' | 'canceled' | 'slow'

/** How long the return page keeps confirming before it says so. */
export const CHECKOUT_SLOW_AFTER_MS = 60_000

/**
 * The return page's state, from the checkout as polled and the way back:
 * Stripe's success URL or its failure (cancel) URL.
 */
export function checkoutOutcome(
  checkout: Pick<SelfBillingCheckout, 'status' | 'terminal'> | null,
  returnedBy: 'success' | 'failure',
  waitedMs: number,
): CheckoutOutcome {
  if (checkout?.status === CheckoutStatus.Completed) return 'success'
  if (checkout?.status === CheckoutStatus.Failed) return 'failed'
  if (returnedBy === 'failure' || checkout?.status === CheckoutStatus.Expired) return 'canceled'
  return waitedMs >= CHECKOUT_SLOW_AFTER_MS ? 'slow' : 'processing'
}
