import { describe, expect, it } from 'vitest'
import {
  activationStartDate,
  activationStartDay,
  contractDateToInstant,
  contractDay,
  createSubscriptionSchema,
  emptyPhase,
  emptySubscription,
} from './subscription'

const base = { ...emptySubscription(), customerId: 'c', planId: 'p', currency: 'USD' }
const endErrors = (value: unknown) => {
  const result = createSubscriptionSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.filter((i) => i.path.at(-1) === 'endDate').map((i) => i.message)
}

describe('contract and phase dates', () => {
  it('accepts an open-ended contract and a later end', () => {
    expect(endErrors(base)).toEqual([])
    expect(
      endErrors({
        ...base,
        startDate: '2030-01-01',
        phases: [{ ...emptyPhase(), endDate: '2031-01-01' }],
      }),
    ).toEqual([])
  })

  it('refuses an end on or before the start', () => {
    expect(
      endErrors({
        ...base,
        startDate: '2030-01-01',
        phases: [{ ...emptyPhase(), endDate: '2030-01-01' }],
      }),
    ).toEqual(['The end has to come after the start'])
  })

  it('treats no start date as today', () => {
    expect(endErrors({ ...base, phases: [{ ...emptyPhase(), endDate: '2000-01-01' }] })).toEqual([
      'The end has to come after the start',
    ])
  })

  it('needs every phase but the last to end, each after the one before', () => {
    expect(
      endErrors({
        ...base,
        startDate: '2030-01-01',
        phases: [
          { ...emptyPhase(), endDate: '' },
          { ...emptyPhase(), endDate: '2031-01-01' },
        ],
      }),
    ).toEqual(['Choose when this phase ends'])
    expect(
      endErrors({
        ...base,
        startDate: '2030-01-01',
        phases: [
          { ...emptyPhase(), endDate: '2030-06-01' },
          { ...emptyPhase(), endDate: '2030-03-01' },
        ],
      }),
    ).toEqual(['The end must be after the start'])
  })
})

describe('billing date (Bill on a date you choose)', () => {
  const anchorErrors = (value: unknown) => {
    const result = createSubscriptionSchema.safeParse(value)
    return result.success
      ? []
      : result.error.issues.filter((i) => i.path.at(-1) === 'billingAnchor').map((i) => i.message)
  }

  it('accepts a date on or after the start', () => {
    expect(anchorErrors({ ...base, startDate: '2030-01-01', billingAnchor: '2030-01-01' })).toEqual(
      [],
    )
    expect(anchorErrors({ ...base, startDate: '2030-01-01', billingAnchor: '2030-01-15' })).toEqual(
      [],
    )
  })

  it('refuses a date before the start', () => {
    expect(anchorErrors({ ...base, startDate: '2030-01-10', billingAnchor: '2030-01-05' })).toEqual(
      ['Choose a date on or after the contract start date'],
    )
    expect(anchorErrors({ ...base, billingAnchor: '2000-01-01' })).toEqual([
      'The contract starts today, so choose today or a later date',
    ])
  })
})

describe('contract dates with a time', () => {
  it('orders a day and an instant by when they fall', () => {
    const start = new Date(2026, 9, 21, 9, 30).toISOString()
    const before = new Date(2026, 9, 21, 9, 0).toISOString()
    const parsed = createSubscriptionSchema.safeParse({
      ...emptySubscription(),
      customerId: 'cus_1',
      planId: 'plan_1',
      currency: 'usd',
      startDate: start,
      phases: [{ ...emptyPhase(), endDate: before }],
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a billing date on the start day whatever the time', () => {
    const parsed = createSubscriptionSchema.safeParse({
      ...emptySubscription(),
      customerId: 'cus_1',
      planId: 'plan_1',
      currency: 'usd',
      startDate: new Date(2026, 9, 21, 9, 30).toISOString(),
      billingAnchor: new Date(2026, 9, 21, 0, 0).toISOString(),
    })
    expect(parsed.success).toBe(true)
  })

  it('sends a day as midnight UTC and an instant as itself', () => {
    expect(contractDateToInstant('2026-10-21').toISOString()).toBe('2026-10-21T00:00:00.000Z')
    expect(contractDateToInstant('2026-10-21T04:00:00.000Z').toISOString()).toBe(
      '2026-10-21T04:00:00.000Z',
    )
    expect(contractDay(new Date(2026, 9, 21, 23, 0).toISOString())).toBe('2026-10-21')
  })
})

describe('activating a draft', () => {
  // Local midnight 4 Nov: in IST this is 2026-11-03T18:30Z, the QA case (#26).
  const saved = new Date(2026, 10, 4)
  const now = new Date(2026, 10, 2, 10, 15)

  it('opens the dialog on the saved start day, else today', () => {
    expect(activationStartDay(saved, now)).toBe('2026-11-04')
    expect(activationStartDay(null, now)).toBe('2026-11-02')
  })

  it('keeps the saved start instant when its day is kept', () => {
    expect(activationStartDate('2026-11-04', saved, now)).toBe(saved)
    expect(activationStartDate('', saved, now)).toBe(saved)
  })

  it('starts now when today is picked, and at local midnight on another day', () => {
    expect(activationStartDate('2026-11-02', saved, now)).toBe(now)
    expect(activationStartDate('2026-11-10', saved, now)).toEqual(new Date(2026, 10, 10))
    expect(activationStartDate('', null, now)).toBe(now)
  })
})
