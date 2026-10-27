import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type AddContractCharge, BillingModel, PriceType } from '@fp/domain'
import { makeCharge } from '../product-catalog/plans/planDetailFixtures'
import { type ChargeRow, chargeInEffect, commitmentChargeOf } from './SubscriptionForm'

const base = {
  id: 'c1',
  name: 'Seat',
  type: 'Fixed',
  status: 'As on the plan',
  price: '$9',
} as const

const planRow = (startDate: Date | null = null, endDate: Date | null = null): ChargeRow => ({
  ...base,
  kind: 'plan',
  charge: { ...makeCharge(0, { type: PriceType.Fixed }), startDate, endDate },
})

const extraRow = (startDate: string): ChargeRow => ({
  ...base,
  kind: 'extra',
  index: 0,
  extra: { startDate } as AddContractCharge,
})

describe('chargeInEffect', () => {
  // A viewer west of UTC, where a UTC-midnight day read in local time is the day before.
  const tz = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles'
  })
  afterAll(() => {
    process.env.TZ = tz
  })

  it('reads a plan charge’s UTC-midnight days in UTC', () => {
    const row = planRow(new Date('2026-11-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))
    expect(chargeInEffect(row)).toBe('Nov 1, 2026 → Jan 1, 2027')
  })

  it('shows an open end as Ongoing and no dates as with the phase', () => {
    expect(chargeInEffect(planRow(new Date('2026-11-01T00:00:00Z')))).toBe('Nov 1, 2026 → Ongoing')
    expect(chargeInEffect(planRow())).toBe('With the phase')
  })

  it('keeps an added charge’s YYYY-MM-DD day as that day', () => {
    expect(chargeInEffect(extraRow('2026-11-01'))).toBe('From Nov 1, 2026')
    expect(chargeInEffect(extraRow(''))).toBe('With the phase')
  })
})

describe('commitmentChargeOf', () => {
  const usage = makeCharge(1, { type: PriceType.Usage, billingModel: BillingModel.FlatFee })

  it("seeds a commitment window at the override's rate when the charge is repriced", () => {
    expect(commitmentChargeOf(usage).unitAmount).toBe(usage.amount)
    expect(
      commitmentChargeOf(usage, {
        priceId: usage.id,
        billingModel: BillingModel.FlatFee,
        amount: '2',
      }).unitAmount,
    ).toBe('2')
  })
})
