import { describe, expect, it } from 'vitest'
import { createSubscriptionSchema, emptyPhase, emptySubscription } from './subscription'

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
