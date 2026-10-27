import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type AddContractCharge, BillingModel, PriceType } from '@fp/domain'
import { makeCharge } from '../product-catalog/plans/planDetailFixtures'
import {
  type ChargeRow,
  chargeInEffect,
  commitmentChargeOf,
  inEffectOn,
  outsideNote,
  windowSeed,
} from './SubscriptionForm'

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

describe('windowSeed', () => {
  const usage = makeCharge(1, { type: PriceType.Usage, billingModel: BillingModel.FlatFee })

  it('keeps a package override per package, with its size', () => {
    expect(
      windowSeed(usage, {
        priceId: usage.id,
        billingModel: BillingModel.Package,
        amount: '10',
        divideBy: 1000,
      }),
    ).toEqual({ unitAmount: '10', packageSize: '1000' })
  })

  it("keeps a package charge's own size when it is not repriced", () => {
    const pack = {
      ...usage,
      billingModel: BillingModel.Package,
      amount: '5',
      transformQuantity: { divideBy: 100, round: null },
    }
    expect(windowSeed(pack)).toEqual({ unitAmount: '5', packageSize: '100' })
  })

  it('starts blank for a tiered override, which has no single rate', () => {
    expect(
      windowSeed(usage, {
        priceId: usage.id,
        billingModel: BillingModel.Tiered,
        tierMode: 'VOLUME',
        tiers: [{ upTo: null, unitAmount: '1' }],
      } as never),
    ).toEqual({ unitAmount: '' })
  })
})

describe('inEffectOn and outsideNote', () => {
  const at = (day: string) => new Date(`${day}T00:00:00Z`)
  const seat = { ...makeCharge(0, { type: PriceType.Fixed }), displayName: 'Seats' }

  it('reads a charge in effect from its start day, and not from its end day', () => {
    expect(inEffectOn({ ...seat, startDate: at('2026-11-01') }, '2026-11-01')).toBe(true)
    expect(inEffectOn({ ...seat, startDate: at('2026-11-02') }, '2026-11-01')).toBe(false)
    expect(inEffectOn({ ...seat, endDate: at('2026-11-01') }, '2026-11-01')).toBe(false)
    expect(inEffectOn(seat, '2026-11-01')).toBe(true)
  })

  it('names each charge outside the start and when it applies', () => {
    expect(outsideNote([{ ...seat, startDate: at('2026-12-01') }], '2026-11-01')).toBe(
      'One charge sits outside the contract start (Nov 1, 2026): Seats, from Dec 1, 2026. It bills only while its own dates are in effect.',
    )
    expect(
      outsideNote(
        [
          { ...seat, startDate: at('2026-12-01') },
          { ...seat, displayName: 'Setup', endDate: at('2026-10-01') },
        ],
        '2026-11-01',
      ),
    ).toBe(
      '2 charges sit outside the contract start (Nov 1, 2026): Seats, from Dec 1, 2026; Setup, ended Oct 1, 2026. Each bills only while its own dates are in effect.',
    )
  })
})
