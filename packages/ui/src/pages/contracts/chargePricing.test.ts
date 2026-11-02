import { describe, expect, it } from 'vitest'
import {
  BillingModel,
  BillingPeriod,
  type Charge,
  InvoiceCadence,
  PriceEntityType,
  PriceType,
  TierMode,
} from '@fp/domain'
import { chargePricing } from './SubscriptionForm'

const flat: Charge = {
  id: 'price_1',
  type: PriceType.Usage,
  billingModel: BillingModel.FlatFee,
  amount: '49',
  displayAmount: '$49.00',
  currency: 'usd',
  billingPeriod: BillingPeriod.Monthly,
  billingPeriodCount: 1,
  invoiceCadence: InvoiceCadence.Arrear,
  billingCadence: 'RECURRING',
  tierMode: null,
  tiers: [],
  transformQuantity: null,
  bucketSize: null,
  meterId: 'meter_1',
  meterName: 'API calls',
  entityType: PriceEntityType.Plan,
  entityId: 'plan_1',
  lookupKey: '',
  description: '',
  displayName: 'API calls',
  startDate: null,
  endDate: null,
  sequence: 1,
  createdAt: null,
}

describe('chargePricing', () => {
  it("shows the plan's amount when there is no override", () => {
    expect(chargePricing(flat, undefined)).toEqual({
      summary: 'Flat fee · $49.00',
      tiers: [],
      overridden: false,
    })
  })

  // A tiered override must replace the plan's displayAmount, not sit beside it.
  it('shows a tiered override as its own model and tiers', () => {
    const pricing = chargePricing(flat, {
      priceId: 'price_1',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      tiers: [
        { upTo: 1000, unitAmount: '0.1' },
        { upTo: null, unitAmount: '0.05', flatAmount: '5' },
      ],
    })
    expect(pricing.overridden).toBe(true)
    expect(pricing.summary).toBe('Tiered (slab) · 2 tiers')
    expect(pricing.summary).not.toContain('$49.00')
    expect(pricing.tiers).toEqual([
      'Up to 1,000: $0.10 / unit',
      'Above 1,000: $0.05 / unit + $5.00 flat',
    ])
  })

  it('prices a package band per package', () => {
    const pricing = chargePricing(flat, {
      priceId: 'price_1',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      tiers: [
        { upTo: 1000, unitAmount: '0' },
        { upTo: null, unitAmount: '1000', transformQuantity: { divideBy: 100, round: 'up' } },
      ],
    })
    expect(pricing.tiers).toEqual([
      'Up to 1,000: $0.00 / unit',
      'Above 1,000: $1,000.00 per 100 units',
    ])
  })

  it('shows a flat-fee override amount', () => {
    expect(
      chargePricing(flat, { priceId: 'price_1', billingModel: BillingModel.FlatFee, amount: '30' })
        .summary,
    ).toBe('Flat fee · $30.00')
  })
})
