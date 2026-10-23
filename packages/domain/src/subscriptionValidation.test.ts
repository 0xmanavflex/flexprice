import { describe, expect, it } from 'vitest'
import { createSubscriptionSchema, emptyPhase, emptySubscription } from './subscription'

const base = { ...emptySubscription(), customerId: 'c', planId: 'p', currency: 'USD' }
const issues = (value: unknown, field: string) => {
  const result = createSubscriptionSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.filter((i) => i.path[0] === field).map((i) => i.message)
}

describe('a contract in phases', () => {
  const phased = {
    ...base,
    phases: [{ ...emptyPhase(), endDate: '2027-01-01' }, emptyPhase()],
  }

  it('needs a start date', () => {
    expect(issues(phased, 'startDate')).toEqual([
      'Choose when the contract starts: a contract in phases needs a start date',
    ])
  })

  it('is accepted once it has one', () => {
    expect(issues({ ...phased, startDate: '2026-11-01' }, 'startDate')).toEqual([])
  })

  it('a single-phase contract may still start today', () => {
    expect(issues(base, 'startDate')).toEqual([])
  })
})

describe('proration and entitlement overrides', () => {
  const override = { entitlementId: 'ent_1', usageLimit: 100 }

  it('cannot be combined, as the API refuses it', () => {
    expect(issues({ ...base, prorate: true, entitlementOverrides: [override] }, 'prorate')).toEqual(
      [
        'Entitlement overrides cannot be combined with proration. Turn off proration or remove the entitlement overrides.',
      ],
    )
  })

  it('either alone is fine', () => {
    expect(issues({ ...base, prorate: true }, 'prorate')).toEqual([])
    expect(issues({ ...base, entitlementOverrides: [override] }, 'prorate')).toEqual([])
  })
})
