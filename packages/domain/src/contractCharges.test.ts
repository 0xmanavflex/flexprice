import { describe, expect, it } from 'vitest'
import { BillingPeriod, PriceType, type Charge } from './price'
import {
  attachableAddonCharges,
  attachableAddonCommitments,
  attachableAddonOverrides,
  cadenceAllowed,
  selectContractCharges,
} from './contractCharges'

const charge = (id: string, billingPeriod: BillingPeriod, extra: Partial<Charge> = {}): Charge =>
  ({ id, billingPeriod, billingPeriodCount: 1, currency: 'usd', ...extra }) as Charge

const monthly = { currency: 'USD', billingPeriod: BillingPeriod.Monthly, billingPeriodCount: 1 }

describe('cadenceAllowed: the API rule', () => {
  it.each([
    [BillingPeriod.Quarterly, 1, BillingPeriod.Monthly, 1, true],
    [BillingPeriod.Quarterly, 1, BillingPeriod.Annual, 1, true],
    [BillingPeriod.Quarterly, 1, BillingPeriod.Monthly, 2, false],
    [BillingPeriod.Quarterly, 1, BillingPeriod.Weekly, 1, false],
    [BillingPeriod.Monthly, 1, BillingPeriod.OneTime, 1, false],
  ])('%s×%i with %s×%i → %s', (sp, sc, ip, ic, expected) => {
    expect(cadenceAllowed(sp, sc, ip, ic)).toBe(expected)
  })
})

describe('selectContractCharges', () => {
  const plan = [
    charge('m', BillingPeriod.Monthly),
    charge('once', BillingPeriod.OneTime),
    charge('q', BillingPeriod.Quarterly),
    charge('w', BillingPeriod.Weekly),
    charge('eur', BillingPeriod.Monthly, { currency: 'eur' }),
  ]

  it('attaches what the API attaches by default, and offers the rest that fits', () => {
    const result = selectContractCharges(plan, { ...monthly, optedInIds: [] })
    expect(result.attached.map((c) => c.id)).toEqual(['m', 'once'])
    expect(result.optional.map((c) => c.id)).toEqual(['q'])
    expect(result.excluded.map((e) => [e.charge.id, e.reason])).toEqual([
      ['w', 'cadence'],
      ['eur', 'currency'],
    ])
    expect(result.includePriceIds).toBeNull()
  })

  it('sends the full list once something is opted in', () => {
    const result = selectContractCharges(plan, { ...monthly, optedInIds: ['q'] })
    expect(result.attached.map((c) => c.id)).toEqual(['m', 'once', 'q'])
    expect(result.includePriceIds).toEqual(['m', 'once', 'q'])
  })

  it('ignores an opt-in that is no longer offered', () => {
    const result = selectContractCharges(plan, {
      ...monthly,
      billingPeriod: BillingPeriod.Weekly,
      optedInIds: ['q'],
    })
    expect(result.includePriceIds).toBeNull()
  })

  it('drops a same-period charge whose count does not fit once the list is explicit', () => {
    const plan2 = [
      charge('m2', BillingPeriod.Monthly, { billingPeriodCount: 2 }),
      charge('a', BillingPeriod.Annual),
    ]
    const contract = { ...monthly, billingPeriodCount: 3 }
    expect(
      selectContractCharges(plan2, { ...contract, optedInIds: [] }).attached.map((c) => c.id),
    ).toEqual(['m2'])
    const opted = selectContractCharges(plan2, { ...contract, optedInIds: ['a'] })
    expect(opted.attached.map((c) => c.id)).toEqual(['a'])
    expect(opted.excluded[0]).toMatchObject({ reason: 'cadence' })
  })
})

describe('attachableAddonCommitments', () => {
  const usage = { type: PriceType.Usage }
  const addon = [
    charge('usd-m', BillingPeriod.Monthly, usage),
    charge('usd-once', BillingPeriod.OneTime, usage),
    charge('usd-q', BillingPeriod.Quarterly, usage),
    charge('eur-m', BillingPeriod.Monthly, { ...usage, currency: 'eur' }),
    charge('usd-fixed', BillingPeriod.Monthly, { type: PriceType.Fixed }),
  ]
  const commitments = ['usd-m', 'usd-once', 'usd-q', 'eur-m', 'usd-fixed'].map((priceId) => ({
    priceId,
  }))
  const ids = (list: readonly { priceId: string }[]) => list.map((c) => c.priceId)

  it('keeps usage charges in the contract currency and period, or one-time', () => {
    expect(ids(attachableAddonCommitments(commitments, addon, monthly))).toEqual([
      'usd-m',
      'usd-once',
    ])
  })

  it('drops a commitment once the currency or period moves away from its price', () => {
    const eur = { currency: 'EUR', billingPeriod: BillingPeriod.Monthly }
    expect(ids(attachableAddonCommitments(commitments, addon, eur))).toEqual(['eur-m'])
    const quarterly = { currency: 'USD', billingPeriod: BillingPeriod.Quarterly }
    expect(ids(attachableAddonCommitments(commitments, addon, quarterly))).toEqual([
      'usd-once',
      'usd-q',
    ])
  })

  it('keeps every commitment while the charges are unknown', () => {
    expect(attachableAddonCommitments(commitments, undefined, monthly)).toEqual(commitments)
  })
})

describe('attachableAddonCharges: an add-on with a fixed and a usage charge', () => {
  const addon = [
    charge('fixed', BillingPeriod.Monthly, { type: PriceType.Fixed }),
    charge('usage', BillingPeriod.Monthly, { type: PriceType.Usage }),
    charge('setup', BillingPeriod.OneTime, { type: PriceType.Fixed }),
    charge('annual', BillingPeriod.Annual, { type: PriceType.Usage }),
  ]

  it('offers every charge that attaches, fixed and usage alike', () => {
    expect(attachableAddonCharges(addon, monthly).map((c) => c.id)).toEqual([
      'fixed',
      'usage',
      'setup',
    ])
  })
})

describe('attachableAddonOverrides', () => {
  const addon = [
    charge('usd-fixed', BillingPeriod.Monthly, { type: PriceType.Fixed }),
    charge('usd-usage', BillingPeriod.Monthly, { type: PriceType.Usage }),
    charge('eur-fixed', BillingPeriod.Monthly, { type: PriceType.Fixed, currency: 'eur' }),
  ]
  const overrides = ['usd-fixed', 'usd-usage', 'eur-fixed'].map((priceId) => ({ priceId }))

  it('keeps overrides on fixed and usage charges that attach, drops the rest', () => {
    expect(attachableAddonOverrides(overrides, addon, monthly).map((o) => o.priceId)).toEqual([
      'usd-fixed',
      'usd-usage',
    ])
  })

  it('keeps every override while the charges are unknown', () => {
    expect(attachableAddonOverrides(overrides, undefined, monthly)).toEqual(overrides)
  })
})
