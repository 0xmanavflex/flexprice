import { describe, expect, it } from 'vitest'
import { BillingModel, BillingPeriod, PriceEntityType, PriceType, TierMode } from '@fp/domain'
import { toCharge, toChargeRequest, toUpdatePriceRequest } from './prices'

describe('toCharge', () => {
  it('maps a plan price to the charge a row renders', () => {
    const charge = toCharge({
      id: 'price_1',
      type: 'USAGE',
      billingModel: 'TIERED',
      tierMode: 'SLAB',
      tiers: [
        { upTo: 100, unitAmount: '0.5' },
        { upTo: null, unitAmount: '0.2' },
      ],
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      invoiceCadence: 'ARREAR',
      meterId: 'meter_1',
      meter: { id: 'meter_1', name: 'API calls' },
      entityType: 'PLAN',
      entityId: 'plan_1',
    })
    expect(charge).toMatchObject({
      id: 'price_1',
      type: PriceType.Usage,
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      meterId: 'meter_1',
      meterName: 'API calls',
      entityId: 'plan_1',
    })
    expect(charge.tiers).toEqual([
      { upTo: 100, unitAmount: '0.5' },
      { upTo: null, unitAmount: '0.2' },
    ])
  })

  it('falls back to the amount when the API sends no display amount', () => {
    expect(toCharge({ id: 'p', amount: '49.00' }).displayAmount).toBe('49.00')
  })
})

describe('toChargeRequest', () => {
  it('tags a flat fee with the plan it prices', () => {
    const body = toChargeRequest(
      {
        type: PriceType.Fixed,
        billingModel: BillingModel.FlatFee,
        amount: '49.00',
        currency: 'usd',
        billingPeriod: BillingPeriod.Monthly,
        invoiceCadence: 'ADVANCE',
        displayName: 'Platform',
        meterId: null,
        tierMode: TierMode.Volume,
        tiers: [],
        divideBy: 1,
      } as never,
      PriceEntityType.Plan,
      'plan_1',
    )
    expect(body).toMatchObject({
      entityType: 'PLAN',
      entityId: 'plan_1',
      amount: '49.00',
      displayName: 'Platform',
    })
    expect(body).not.toHaveProperty('meterId')
  })
})

describe('toUpdatePriceRequest', () => {
  it('sends only the price itself, never currency, period or meter', () => {
    const body = toUpdatePriceRequest({
      type: PriceType.Fixed,
      billingModel: BillingModel.FlatFee,
      amount: '59.00',
      currency: 'usd',
      billingPeriod: BillingPeriod.Monthly,
      invoiceCadence: 'ADVANCE',
      effectiveFrom: '2026-11-01',
      meterId: null,
      tierMode: TierMode.Volume,
      tiers: [],
      divideBy: 1,
    } as never)
    expect(body).toEqual({
      billingModel: 'FLAT_FEE',
      amount: '59.00',
      effectiveFrom: '2026-11-01T00:00:00Z',
    })
  })
})
