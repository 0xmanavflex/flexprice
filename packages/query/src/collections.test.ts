import { describe, expect, it } from 'vitest'
import { summariseCollections } from './collections'

const now = new Date('2026-10-07T00:00:00Z')
const wire = (over: Record<string, unknown>) => ({
  id: 'inv',
  currency: 'USD',
  invoiceStatus: 'FINALIZED',
  paymentStatus: 'PENDING',
  amountRemaining: '10.00',
  dueDate: new Date('2026-11-01T00:00:00Z'),
  ...over,
})

describe('summariseCollections', () => {
  it('adds up what is unpaid and what is past due, exactly', () => {
    const summary = summariseCollections(
      [
        wire({ amountRemaining: '0.10' }),
        wire({ amountRemaining: '0.20', dueDate: new Date('2026-09-01T00:00:00Z') }),
        wire({ amountRemaining: '5', paymentStatus: 'FAILED' }),
        wire({ amountRemaining: '0.00', paymentStatus: 'SUCCEEDED' }),
        wire({ invoiceStatus: 'DRAFT', amountRemaining: '99.00' }),
      ],
      false,
      now,
    )
    expect(summary.outstanding).toEqual({ amount: '5.30', currency: 'USD' })
    expect(summary.overdue).toEqual({ amount: '5.20', currency: 'USD' })
    expect(summary.unpaidCount).toBe(3)
    expect(summary.overdueCount).toBe(2)
  })

  it('counts other currencies instead of mixing them in', () => {
    const summary = summariseCollections(
      [wire({}), wire({}), wire({ currency: 'EUR', amountRemaining: '7.00' })],
      false,
      now,
    )
    expect(summary.outstanding).toEqual({ amount: '20.00', currency: 'USD' })
    expect(summary.otherCurrencies).toBe(1)
  })

  it('has nothing to total when nothing is owed', () => {
    const summary = summariseCollections([wire({ amountRemaining: '0.00' })], false, now)
    expect(summary.outstanding).toBeNull()
    expect(summary.unpaidCount).toBe(0)
  })
})
