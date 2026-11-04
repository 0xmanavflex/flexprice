import { describe, expect, it } from 'vitest'
import { CreditGrantExpiryType, emptyCreditGrant } from '@fp/domain'
import { toCreditGrantTerms } from './creditGrants'

describe('toCreditGrantTerms', () => {
  it('sends the Days the form shows when the unit was never touched', () => {
    const draft = {
      ...emptyCreditGrant(),
      credits: '17.5',
      expirationType: CreditGrantExpiryType.Duration,
      expirationDuration: 9,
    }
    expect(toCreditGrantTerms(draft)).toMatchObject({
      expirationType: 'DURATION',
      expirationDuration: 9,
      expirationDurationUnit: 'DAY',
    })
  })

  it('sends a duration with no unit in days rather than with none', () => {
    const { expirationDurationUnit: _unit, ...draft } = emptyCreditGrant()
    expect(
      toCreditGrantTerms({
        ...draft,
        expirationType: CreditGrantExpiryType.Duration,
        expirationDuration: 7,
      }),
    ).toMatchObject({ expirationDuration: 7, expirationDurationUnit: 'DAY' })
  })

  it('sends no duration for a grant that never expires', () => {
    const terms = toCreditGrantTerms(emptyCreditGrant())
    expect(terms).not.toHaveProperty('expirationDuration')
    expect(terms).not.toHaveProperty('expirationDurationUnit')
  })
})
