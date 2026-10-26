import { describe, expect, it } from 'vitest'
import {
  InvoiceStatus,
  deriveInvoiceStatus,
  isPastDue,
  needsAttention,
  sumLineAmounts,
} from './invoice'

const PAST = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2027-01-01T00:00:00Z')
const NOW = new Date('2026-06-01T00:00:00Z')

function derive(overrides: Partial<Parameters<typeof deriveInvoiceStatus>[0]> = {}) {
  return deriveInvoiceStatus({
    invoiceStatus: 'FINALIZED',
    paymentStatus: 'PENDING',
    dueDate: FUTURE,
    hasOutstandingBalance: true,
    now: NOW,
    ...overrides,
  })
}

describe('deriveInvoiceStatus', () => {
  it('collapses three API status fields into the one a person asks about', () => {
    expect(derive()).toBe(InvoiceStatus.Open)
  })

  // Overdue is not a field on the API. It is the reason this function exists.
  it('derives overdue from a past due date and an unpaid balance', () => {
    expect(derive({ dueDate: PAST })).toBe(InvoiceStatus.Overdue)
  })

  it('does not call a paid invoice overdue, however old', () => {
    expect(derive({ dueDate: PAST, paymentStatus: 'SUCCEEDED' })).toBe(InvoiceStatus.Paid)
    expect(derive({ dueDate: PAST, hasOutstandingBalance: false })).toBe(InvoiceStatus.Paid)
  })

  it('does not call an invoice overdue before its due date', () => {
    expect(derive({ dueDate: FUTURE })).toBe(InvoiceStatus.Open)
  })

  it('treats a missing due date as not overdue rather than as overdue', () => {
    // A finalized invoice with no due date is open, not a problem to chase.
    expect(derive({ dueDate: null })).toBe(InvoiceStatus.Open)
  })

  // Terminal states outrank whatever the payment status says.
  it.each([
    ['VOIDED', InvoiceStatus.Void],
    ['SKIPPED', InvoiceStatus.Skipped],
    ['DRAFT', InvoiceStatus.Draft],
  ])('treats %s as terminal, ignoring an overdue balance', (invoiceStatus, expected) => {
    expect(derive({ invoiceStatus, dueDate: PAST, paymentStatus: 'FAILED' })).toBe(expected)
  })

  it('does not report a draft as unpaid work to chase', () => {
    expect(derive({ invoiceStatus: 'DRAFT', dueDate: PAST })).toBe(InvoiceStatus.Draft)
  })

  it('survives the API sending nothing at all', () => {
    expect(
      deriveInvoiceStatus({
        invoiceStatus: undefined,
        paymentStatus: undefined,
        dueDate: undefined,
        hasOutstandingBalance: false,
      }),
    ).toBe(InvoiceStatus.Paid)
  })

  it('treats a failed payment as still owed, not as settled', () => {
    expect(derive({ paymentStatus: 'FAILED', dueDate: PAST })).toBe(InvoiceStatus.Overdue)
  })
})

describe('needsAttention', () => {
  it('flags only overdue', () => {
    expect(needsAttention(InvoiceStatus.Overdue)).toBe(true)
    for (const status of [
      InvoiceStatus.Draft,
      InvoiceStatus.Open,
      InvoiceStatus.Paid,
      InvoiceStatus.Void,
      InvoiceStatus.Skipped,
    ]) {
      expect(needsAttention(status), status).toBe(false)
    }
  })
})

describe('sumLineAmounts', () => {
  it('sums exactly where a float would drift', () => {
    expect(sumLineAmounts(['0.1', '0.2'])).toBe('0.30')
    expect(sumLineAmounts(['12345678901234567.89', '0.01'])).toBe('12345678901234567.90')
  })

  it('keeps at least two decimals and trims the rest', () => {
    expect(sumLineAmounts(['250'])).toBe('250.00')
    expect(sumLineAmounts(['1.123', '1'])).toBe('2.123')
  })

  it('returns null while any amount is blank or malformed', () => {
    expect(sumLineAmounts(['10', ''])).toBeNull()
    expect(sumLineAmounts(['abc'])).toBeNull()
    expect(sumLineAmounts(['-5'])).toBeNull()
  })
})

describe('isPastDue', () => {
  const due = new Date('2026-10-26T00:00:00Z')
  it('is not past due on the due day itself, whatever the hour', () => {
    expect(isPastDue(due, new Date('2026-10-26T23:59:00Z'))).toBe(false)
  })
  it('is past due from the next calendar day, in UTC', () => {
    expect(isPastDue(due, new Date('2026-10-27T00:00:00Z'))).toBe(true)
  })
  it('is never past due without a due date', () => {
    expect(isPastDue(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })
})
