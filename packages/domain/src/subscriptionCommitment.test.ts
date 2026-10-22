import { describe, expect, it } from 'vitest'
import { BillingPeriod } from './price'
import { commitmentPeriodNoun } from './subscription'

describe('commitmentPeriodNoun', () => {
  it('names one period as the noun that follows "per"', () => {
    expect(commitmentPeriodNoun(BillingPeriod.Monthly)).toBe('month')
    expect(commitmentPeriodNoun(BillingPeriod.Quarterly)).toBe('quarter')
    expect(commitmentPeriodNoun(BillingPeriod.HalfYearly)).toBe('half-year')
    expect(commitmentPeriodNoun(BillingPeriod.Annual)).toBe('year')
    expect(commitmentPeriodNoun(BillingPeriod.Weekly)).toBe('week')
    expect(commitmentPeriodNoun(BillingPeriod.Daily)).toBe('day')
  })

  it('counts months, and reads twelve of them as a year', () => {
    expect(commitmentPeriodNoun(BillingPeriod.Monthly, 3)).toBe('3 months')
    expect(commitmentPeriodNoun(BillingPeriod.Monthly, 12)).toBe('year')
    expect(commitmentPeriodNoun(BillingPeriod.Monthly, 1)).toBe('month')
  })

  it('counts every other period too', () => {
    expect(commitmentPeriodNoun(BillingPeriod.Weekly, 2)).toBe('2 weeks')
    expect(commitmentPeriodNoun(BillingPeriod.Daily, 7)).toBe('7 days')
    expect(commitmentPeriodNoun(BillingPeriod.Quarterly, 2)).toBe('2 quarters')
    expect(commitmentPeriodNoun(BillingPeriod.Annual, 3)).toBe('3 years')
  })
})
