import { describe, expect, it } from 'vitest'
import { contractAmountPerPeriod } from './contractAmount'
import { BillingPeriod } from './price'

describe('contractAmountPerPeriod', () => {
  it('spreads a contract amount over the billing period, as V1 does', () => {
    // V1's own examples: 1200 a year billed monthly; 100 a week billed monthly.
    expect(contractAmountPerPeriod('1200', BillingPeriod.Annual, BillingPeriod.Monthly)).toBe(
      '100.00',
    )
    expect(contractAmountPerPeriod('100', BillingPeriod.Weekly, BillingPeriod.Monthly)).toBe(
      '400.00',
    )
    expect(contractAmountPerPeriod('30', BillingPeriod.Monthly, BillingPeriod.Daily)).toBe('1.00')
  })

  it('rounds half up to cents, exactly', () => {
    expect(contractAmountPerPeriod('1000', BillingPeriod.Annual, BillingPeriod.Monthly)).toBe(
      '83.33',
    )
    expect(contractAmountPerPeriod('0.10', BillingPeriod.Annual, BillingPeriod.Quarterly)).toBe(
      '0.03',
    )
    expect(contractAmountPerPeriod('1,200.50', BillingPeriod.Annual, BillingPeriod.Annual)).toBe(
      '1200.50',
    )
  })

  it('refuses what is not a plain amount', () => {
    expect(contractAmountPerPeriod('', BillingPeriod.Annual, BillingPeriod.Monthly)).toBeNull()
    expect(contractAmountPerPeriod('-5', BillingPeriod.Annual, BillingPeriod.Monthly)).toBeNull()
    expect(contractAmountPerPeriod('abc', BillingPeriod.Annual, BillingPeriod.Monthly)).toBeNull()
  })
})
