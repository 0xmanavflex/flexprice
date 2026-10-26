import { z } from 'zod'

/**
 * Forex (FX) rates: how one currency converts into another when a customer is
 * billed in a currency other than the price's.
 *
 * A **global** rate (scope `tenant`) is the default for a pair; there is one per
 * pair, it has no validity window and it cannot be deleted, because every
 * override falls back to it. A customer or contract **override** replaces it for
 * that customer or contract, optionally for a window; windows for one pair must
 * not overlap. Rates are decimal strings and stay strings: an invoice
 * converted through a float is a rounding error on every line.
 *
 * Only fixed rates are listed and created: the API stores market rates but
 * cannot resolve them yet, as V1 does.
 */

export const FxRateScope = {
  Tenant: 'tenant',
  Customer: 'customer',
  Subscription: 'subscription',
} as const
export type FxRateScope = (typeof FxRateScope)[keyof typeof FxRateScope]

export interface FxRate {
  id: string
  scope: FxRateScope
  /** The customer or contract an override belongs to; empty for a global rate. */
  scopeId: string
  /** Lower-case ISO codes, as the API stores them. */
  fromCurrency: string
  toCurrency: string
  /** One unit of `fromCurrency` in `toCurrency`, as a decimal string. */
  rate: string
  /** Overrides only: the window, ISO instants; null is open-ended. */
  startDate: string | null
  endDate: string | null
  updatedAt: Date | null
}

const RATE = /^\d+(\.\d+)?$/

/** What the add/edit dialog holds. Dates are ISO instants, empty for none. */
export interface FxRateDraft {
  fromCurrency: string
  toCurrency: string
  rate: string
  startDate: string
  endDate: string
}

export function emptyFxRateDraft(from = '', to = ''): FxRateDraft {
  return { fromCurrency: from, toCurrency: to, rate: '', startDate: '', endDate: '' }
}

export const fxRateDraftSchema = z
  .object({
    fromCurrency: z.string(),
    toCurrency: z.string(),
    rate: z.string().trim(),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((draft, ctx) => {
    if (!draft.fromCurrency || !draft.toCurrency) {
      ctx.addIssue({ code: 'custom', path: ['fromCurrency'], message: 'Select both currencies.' })
    } else if (draft.fromCurrency.toLowerCase() === draft.toCurrency.toLowerCase()) {
      ctx.addIssue({
        code: 'custom',
        path: ['toCurrency'],
        message: 'From and To must be different currencies.',
      })
    }
    if (!draft.rate) {
      ctx.addIssue({ code: 'custom', path: ['rate'], message: 'Enter a rate.' })
    } else if (!RATE.test(draft.rate) || !(Number(draft.rate) > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rate'],
        message: 'Rate must be a number greater than 0.',
      })
    }
    if (draft.startDate && draft.endDate && new Date(draft.startDate) >= new Date(draft.endDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Valid from must be before Valid until.',
      })
    }
  })

/** A rate's draft, so the edit dialog opens on its values. */
export function fxRateToDraft(rate: FxRate): FxRateDraft {
  return {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: rate.rate,
    startDate: rate.startDate ?? '',
    endDate: rate.endDate ?? '',
  }
}

/** Pads a decimal string to two fraction digits, never rounding: "83" is "83.00". */
export function formatFxRateValue(rate: string): string {
  const [whole = '0', fraction = ''] = rate.trim().split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

/** "1 USD = 83.00 INR": one unit of `from` in `to`. */
export function formatFxRate(from: string, to: string, rate: string): string {
  return `1 ${from.toUpperCase()} = ${formatFxRateValue(rate)} ${to.toUpperCase()}`
}

/** "USD → INR". */
export function formatFxPair(from: string, to: string): string {
  return `${from.toUpperCase()} → ${to.toUpperCase()}`
}

export const FxOverrideStatus = {
  Active: 'active',
  Scheduled: 'scheduled',
  Expired: 'expired',
} as const
export type FxOverrideStatus = (typeof FxOverrideStatus)[keyof typeof FxOverrideStatus]

export const FX_OVERRIDE_STATUS_LABEL: Record<FxOverrideStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
}

/** Where `now` falls in a [start, end) window; a missing bound is open. */
export function fxOverrideStatus(
  start: string | null,
  end: string | null,
  now: Date = new Date(),
): FxOverrideStatus {
  if (start && new Date(start).getTime() > now.getTime()) return FxOverrideStatus.Scheduled
  if (end && new Date(end).getTime() <= now.getTime()) return FxOverrideStatus.Expired
  return FxOverrideStatus.Active
}

/** Whether two [start, end) windows meet; a missing start is −∞, a missing end +∞. */
export function fxWindowsOverlap(
  a: { startDate: string | null; endDate: string | null },
  b: { startDate: string | null; endDate: string | null },
): boolean {
  const time = (value: string | null) => (value ? new Date(value).getTime() : undefined)
  const aStart = time(a.startDate)
  const aEnd = time(a.endDate)
  const bStart = time(b.startDate)
  const bEnd = time(b.endDate)
  if (aStart !== undefined && bEnd !== undefined && aStart >= bEnd) return false
  if (bStart !== undefined && aEnd !== undefined && bStart >= aEnd) return false
  return true
}
