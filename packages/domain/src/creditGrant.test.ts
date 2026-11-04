import { describe, expect, it } from 'vitest'
import { CreditGrantExpiryType, creditGrantExpiryLabel, emptyCreditGrant } from './creditGrant'

describe('creditGrantExpiryLabel', () => {
  const duration = (expirationDuration: number, unit?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR') => ({
    expirationType: CreditGrantExpiryType.Duration,
    expirationDuration,
    expirationDurationUnit: unit ?? null,
  })

  it('names the length of a duration expiry, singular or plural', () => {
    expect(creditGrantExpiryLabel(duration(9, 'DAY'))).toBe('Expires after 9 days')
    expect(creditGrantExpiryLabel(duration(1, 'DAY'))).toBe('Expires after 1 day')
    expect(creditGrantExpiryLabel(duration(2, 'WEEK'))).toBe('Expires after 2 weeks')
    expect(creditGrantExpiryLabel(duration(1, 'YEAR'))).toBe('Expires after 1 year')
    expect(creditGrantExpiryLabel(duration(7))).toBe('Expires after 7 days')
  })

  it('keeps the type label for the other expiries, and a duration with no length', () => {
    expect(creditGrantExpiryLabel({ expirationType: CreditGrantExpiryType.Never })).toBe(
      'Never expires',
    )
    expect(creditGrantExpiryLabel({ expirationType: CreditGrantExpiryType.BillingCycle })).toBe(
      'Expires at the end of the billing period',
    )
    expect(
      creditGrantExpiryLabel({
        expirationType: CreditGrantExpiryType.Duration,
        expirationDuration: null,
      }),
    ).toBe('Expires after a set duration')
  })
})

describe('emptyCreditGrant', () => {
  it('starts with the Days unit the form shows', () => {
    expect(emptyCreditGrant().expirationDurationUnit).toBe('DAY')
  })
})
